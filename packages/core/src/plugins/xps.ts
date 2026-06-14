import JSZip from "jszip";
import type { PreviewPlugin } from "../types";
import { createPanel, createSection, readArrayBuffer } from "./utils";

const xpsMimeTypes = new Set([
  "application/oxps",
  "application/vnd.ms-xpsdocument"
]);

export function xpsPlugin(): PreviewPlugin {
  return {
    name: "xps",
    match(file) {
      return file.extension === "xps" || file.extension === "oxps" || xpsMimeTypes.has(file.mimeType);
    },
    async render(ctx) {
      const panel = createPanel("ofv-xps");
      ctx.viewport.append(panel);

      try {
        const zip = await JSZip.loadAsync(await readArrayBuffer(ctx.file));
        await renderXps(panel, zip);
      } catch (error) {
        renderXpsFallback(panel, error);
      }

      return {
        destroy() {
          panel.remove();
        }
      };
    }
  };
}

async function renderXps(panel: HTMLElement, zip: JSZip): Promise<void> {
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const fixedPages = entries
    .filter((entry) => /(?:^|\/)Pages\/[^/]+\.fpage$/i.test(entry.name) || entry.name.endsWith(".fpage"))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const resourceEntries = entries.filter((entry) => /\.(?:png|jpe?g|tiff?|wdp|bmp|gif|odttf|ttf)$/i.test(entry.name));

  const summary = createSection("XPS 基础预览");
  const note = document.createElement("p");
  note.textContent = "当前版本提取 XPS/OXPS 包内 FixedPage 文本、页面顺序和资源结构。完整版式渲染可后续接入专用渲染器。";
  summary.append(note);
  const meta = document.createElement("div");
  meta.className = "ofv-xps-meta";
  appendMeta(meta, "页面", fixedPages.length);
  appendMeta(meta, "资源", resourceEntries.length);
  appendMeta(meta, "文件", entries.length);
  summary.append(meta);
  panel.append(summary);

  const pages = createSection(`页面文本 ${fixedPages.length}`);
  const reader = document.createElement("div");
  reader.className = "ofv-xps-pages";

  if (fixedPages.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "未解析到 FixedPage 页面。";
    reader.append(empty);
  } else {
    for (const [index, entry] of fixedPages.slice(0, 80).entries()) {
      const xml = await entry.async("text");
      reader.append(renderXpsPage(xml, entry.name, index));
    }
  }
  pages.append(reader);
  panel.append(pages);

  const structure = createSection(`文件结构 ${entries.length}`);
  const list = document.createElement("ul");
  for (const entry of entries.slice(0, 240)) {
    const item = document.createElement("li");
    item.textContent = entry.name;
    list.append(item);
  }
  structure.append(list);
  panel.append(structure);
}

function renderXpsPage(xml: string, path: string, index: number): HTMLElement {
  const page = document.createElement("article");
  page.className = "ofv-xps-page";
  const heading = document.createElement("h4");
  heading.textContent = `Page ${index + 1}`;
  const pathMeta = document.createElement("span");
  pathMeta.textContent = path;

  const text = document.createElement("div");
  text.className = "ofv-xps-text";
  const fragments = extractXpsText(xml);
  if (fragments.length > 0) {
    for (const fragment of fragments) {
      const paragraph = document.createElement("p");
      paragraph.textContent = fragment;
      text.append(paragraph);
    }
  } else {
    const empty = document.createElement("p");
    empty.textContent = "这一页未提取到 Glyphs 文本。";
    text.append(empty);
  }

  page.append(heading, pathMeta, text);
  return page;
}

function extractXpsText(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) {
    return extractXpsTextByRegex(xml);
  }
  return Array.from(doc.getElementsByTagName("*"))
    .filter((element) => element.localName === "Glyphs")
    .map((glyph) => getXmlAttribute(glyph, "UnicodeString") || "")
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function extractXpsTextByRegex(xml: string): string[] {
  return [...xml.matchAll(/\bUnicodeString=(?:"([^"]*)"|'([^']*)')/g)]
    .map((match) => decodeXml(match[1] || match[2] || ""))
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function renderXpsFallback(panel: HTMLElement, error: unknown): void {
  panel.replaceChildren();
  const fallback = document.createElement("div");
  fallback.className = "ofv-fallback";
  const title = document.createElement("strong");
  title.textContent = "XPS 解析失败";
  const meta = document.createElement("span");
  meta.textContent = error instanceof Error ? error.message : "文件可能已损坏，或不是有效的 XPS/OXPS 包。";
  fallback.append(title, meta);
  panel.append(fallback);
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

function decodeXml(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}
