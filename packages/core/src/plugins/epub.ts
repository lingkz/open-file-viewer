import JSZip from "jszip";
import DOMPurify from "dompurify";
import type { PreviewPlugin } from "../types";
import { createPanel, createSection, readArrayBuffer } from "./utils";

const epubMimeTypes = new Set(["application/epub+zip", "application/x-epub+zip"]);

type EpubManifestItem = {
  href: string;
  mediaType: string;
  properties: string;
};

type EpubMetadata = {
  title: string;
  creator: string;
  language: string;
};

export function epubPlugin(): PreviewPlugin {
  return {
    name: "epub",
    match(file) {
      return file.extension === "epub" || epubMimeTypes.has(file.mimeType);
    },
    async render(ctx) {
      const panel = createPanel("ofv-epub");
      ctx.viewport.append(panel);

      try {
        const zip = await JSZip.loadAsync(await readArrayBuffer(ctx.file));
        await renderEpub(panel, zip);
      } catch (error) {
        renderEpubFallback(panel, error);
      }

      return {
        destroy() {
          panel.remove();
        }
      };
    }
  };
}

async function renderEpub(panel: HTMLElement, zip: JSZip): Promise<void> {
  const opfPath = await resolvePackagePath(zip);
  const opfText = await zip.file(opfPath)?.async("text");
  if (!opfText) {
    throw new Error("EPUB 缺少 OPF package 文件。");
  }

  const opf = parseXml(opfText, "EPUB package 文件解析失败。");
  const basePath = directoryName(opfPath);
  const manifest = readManifest(opf);
  const spine = readSpine(opf, manifest);
  const metadata = readMetadata(opf);
  const assets = await readEpubAssets(zip, basePath, manifest);

  const summary = createSection("EPUB 图书信息");
  const meta = document.createElement("div");
  meta.className = "ofv-epub-meta";
  appendMeta(meta, "标题", metadata.title || "未命名 EPUB");
  appendMeta(meta, "作者", metadata.creator || "未知");
  appendMeta(meta, "语言", metadata.language || "未声明");
  appendMeta(meta, "章节", spine.length || "未解析到阅读顺序");
  summary.append(meta);
  panel.append(summary);

  const chapters = createSection("EPUB 正文预览");
  const article = document.createElement("article");
  article.className = "ofv-epub-reader";

  if (spine.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "未解析到可展示章节。";
    article.append(empty);
  } else {
    for (const [index, item] of spine.slice(0, 40).entries()) {
      const chapterPath = joinZipPath(basePath, item.href);
      const chapterText = await zip.file(chapterPath)?.async("text");
      if (!chapterText) {
        continue;
      }
      const section = document.createElement("section");
      section.className = "ofv-epub-chapter";
      const heading = document.createElement("h3");
      heading.textContent = chapterTitle(chapterText) || `章节 ${index + 1}`;
      const content = document.createElement("div");
      content.className = "ofv-epub-content";
      content.innerHTML = sanitizeChapterHtml(rewriteAssetReferences(chapterText, assets, directoryName(chapterPath)));
      section.append(heading, content);
      article.append(section);
    }
  }

  chapters.append(article);
  panel.append(chapters);
}

async function resolvePackagePath(zip: JSZip): Promise<string> {
  const containerXml = await zip.file("META-INF/container.xml")?.async("text");
  if (containerXml) {
    const container = parseXml(containerXml, "EPUB container.xml 解析失败。");
    const rootfile = Array.from(container.getElementsByTagName("*")).find(
      (element) => element.localName === "rootfile" && getXmlAttribute(element, "full-path")
    );
    const fullPath = rootfile ? getXmlAttribute(rootfile, "full-path") : null;
    if (fullPath && zip.file(fullPath)) {
      return fullPath;
    }
  }

  const fallback = Object.values(zip.files).find((entry) => !entry.dir && entry.name.endsWith(".opf"));
  if (!fallback) {
    throw new Error("EPUB 未找到 package OPF 文件。");
  }
  return fallback.name;
}

function readManifest(opf: Document): Map<string, EpubManifestItem> {
  const manifest = new Map<string, EpubManifestItem>();
  for (const item of Array.from(opf.getElementsByTagName("*")).filter((element) => element.localName === "item")) {
    const id = getXmlAttribute(item, "id");
    const href = getXmlAttribute(item, "href");
    if (!id || !href) {
      continue;
    }
    manifest.set(id, {
      href,
      mediaType: getXmlAttribute(item, "media-type") || "",
      properties: getXmlAttribute(item, "properties") || ""
    });
  }
  return manifest;
}

function readSpine(opf: Document, manifest: Map<string, EpubManifestItem>): EpubManifestItem[] {
  const items: EpubManifestItem[] = [];
  for (const itemref of Array.from(opf.getElementsByTagName("*")).filter((element) => element.localName === "itemref")) {
    const idref = getXmlAttribute(itemref, "idref");
    const item = idref ? manifest.get(idref) : undefined;
    if (item && isChapterMediaType(item.mediaType)) {
      items.push(item);
    }
  }
  if (items.length > 0) {
    return items;
  }
  return Array.from(manifest.values()).filter((item) => isChapterMediaType(item.mediaType));
}

function readMetadata(opf: Document): EpubMetadata {
  return {
    title: textByLocalName(opf, "title"),
    creator: textByLocalName(opf, "creator"),
    language: textByLocalName(opf, "language")
  };
}

async function readEpubAssets(
  zip: JSZip,
  basePath: string,
  manifest: Map<string, EpubManifestItem>
): Promise<Map<string, string>> {
  const assets = new Map<string, string>();
  for (const item of manifest.values()) {
    if (!item.mediaType.startsWith("image/")) {
      continue;
    }
    const path = joinZipPath(basePath, item.href);
    const entry = zip.file(path);
    if (!entry) {
      continue;
    }
    assets.set(path, `data:${item.mediaType};base64,${await entry.async("base64")}`);
  }
  return assets;
}

function rewriteAssetReferences(html: string, assets: Map<string, string>, chapterDir: string): string {
  const documentHtml = new DOMParser().parseFromString(html, "text/html");
  for (const image of Array.from(documentHtml.querySelectorAll<HTMLImageElement>("img[src], image[href], image[xlink\\:href]"))) {
    const raw = image.getAttribute("src") || image.getAttribute("href") || image.getAttribute("xlink:href") || "";
    const path = joinZipPath(chapterDir, raw.split("#")[0] || raw);
    const src = assets.get(path);
    if (!src) {
      continue;
    }
    image.setAttribute("src", src);
    image.setAttribute("href", src);
    image.setAttribute("xlink:href", src);
  }
  return documentHtml.body.innerHTML;
}

function sanitizeChapterHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, svg: true, svgFilters: false },
    ADD_ATTR: ["target", "xlink:href"]
  });
}

function chapterTitle(html: string): string {
  const documentHtml = new DOMParser().parseFromString(html, "text/html");
  const heading = documentHtml.querySelector("h1, h2, h3, title");
  return heading?.textContent?.trim() || "";
}

function renderEpubFallback(panel: HTMLElement, error: unknown): void {
  panel.replaceChildren();
  const fallback = document.createElement("div");
  fallback.className = "ofv-fallback";
  const title = document.createElement("strong");
  title.textContent = "EPUB 解析失败";
  const meta = document.createElement("span");
  meta.textContent = error instanceof Error ? error.message : "文件可能已损坏，或不是有效的 EPUB。";
  fallback.append(title, meta);
  panel.append(fallback);
}

function parseXml(xml: string, message: string): Document {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error(message);
  }
  return doc;
}

function appendMeta(parent: HTMLElement, label: string, value: string | number): void {
  const row = document.createElement("div");
  row.className = "ofv-meta-row";
  const key = document.createElement("span");
  key.textContent = label;
  const content = document.createElement("strong");
  content.textContent = String(value);
  row.append(key, content);
  parent.append(row);
}

function textByLocalName(doc: Document, localName: string): string {
  return (
    Array.from(doc.getElementsByTagName("*"))
      .find((element) => element.localName === localName)
      ?.textContent?.trim() || ""
  );
}

function getXmlAttribute(element: Element, localName: string): string | null {
  const direct = element.getAttribute(localName);
  if (direct !== null) {
    return direct;
  }
  for (const attribute of Array.from(element.attributes)) {
    if (attribute.localName === localName) {
      return attribute.value;
    }
  }
  return null;
}

function isChapterMediaType(mediaType: string): boolean {
  return mediaType === "application/xhtml+xml" || mediaType === "text/html" || mediaType === "application/xml";
}

function directoryName(path: string): string {
  const index = path.lastIndexOf("/");
  return index >= 0 ? path.slice(0, index + 1) : "";
}

function joinZipPath(basePath: string, path: string): string {
  const parts = `${basePath}${path}`.split("/");
  const normalized: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      normalized.pop();
    } else {
      normalized.push(part);
    }
  }
  return normalized.join("/");
}
