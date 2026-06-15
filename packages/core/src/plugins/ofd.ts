import JSZip from "jszip";
import { createObjectUrl, revokeObjectUrl } from "../dom";
import type { PreviewPlugin } from "../types";
import { createPanel, createSection, readArrayBuffer } from "./utils";

export function ofdPlugin(): PreviewPlugin {
  return {
    name: "ofd",
    match(file) {
      return file.extension === "ofd" || file.mimeType === "application/ofd";
    },
    async render(ctx) {
      const panel = createPanel("ofv-ofd");
      const url = createObjectUrl(ctx.file);
      const isExternal = Boolean(ctx.file.url);
      ctx.viewport.append(panel);
      let zip: JSZip;
      try {
        zip = await JSZip.loadAsync(await readArrayBuffer(ctx.file));
      } catch (error) {
        panel.append(createOfdFallback(ctx.file.name, url, normalizeOfdError(error)));
        return {
          destroy() {
            panel.remove();
            revokeObjectUrl(url, isExternal);
          }
        };
      }

      const entries = Object.values(zip.files).filter((entry) => !entry.dir);
      const textFragments: string[] = [];

      try {
        for (const entry of entries.filter((item) => item.name.endsWith(".xml")).slice(0, 40)) {
          const xml = await entry.async("text");
          const matches = [...xml.matchAll(/>([^<>]{2,})</g)]
            .map((match) => match[1]?.trim())
            .filter(Boolean) as string[];
          textFragments.push(...matches);
        }
      } catch (error) {
        panel.append(createOfdFallback(ctx.file.name, url, normalizeOfdError(error)));
        return {
          destroy() {
            panel.remove();
            revokeObjectUrl(url, isExternal);
          }
        };
      }

      const images = await readOfdImages(entries);
      const pages = await readOfdPages(entries, images);
      const section = createSection("OFD 基础预览");
      const note = document.createElement("p");
      note.textContent = pages.length > 0
        ? "当前版本提取 OFD 页面文本、路径、直线和图片对象，并按 Boundary 坐标生成轻量 SVG 版式预览。复杂字体、签章和颜色空间可后续接入专用 OFD 渲染器。"
        : "当前版本提取 OFD 包内 XML 文本和文件结构。版式级渲染可在后续接入专用 OFD 渲染器。";
      section.append(note);
      section.append(createOfdSummary(entries, pages, images));

      if (pages.length > 0) {
        const pagesWrap = document.createElement("div");
        pagesWrap.className = "ofv-ofd-pages";
        for (const page of pages) {
          pagesWrap.append(renderOfdPage(page));
        }
        section.append(pagesWrap);
      }

      const content = document.createElement("pre");
      content.className = "ofv-text-block";
      content.textContent = textFragments.slice(0, 300).join("\n") || "未提取到可读文本。";
      section.append(content);

      const list = createSection(`文件结构 ${entries.length}`);
      const ul = document.createElement("ul");
      for (const entry of entries.slice(0, 200)) {
        const li = document.createElement("li");
        li.textContent = entry.name;
        ul.append(li);
      }
      list.append(ul);
      panel.append(section, list);

      return {
        destroy() {
          panel.remove();
          revokeObjectUrl(url, isExternal);
        }
      };
    }
  };
}

type OfdTextObject = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  size: number;
  color: string;
  weight: string;
  letterSpacing?: number;
};

type OfdPathObject = {
  d: string;
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
  fill: string;
  strokeWidth: number;
};

type OfdLineObject = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
};

type OfdImageObject = {
  x: number;
  y: number;
  width: number;
  height: number;
  resourceId: string;
  href?: string;
};

type OfdPagePreview = {
  name: string;
  width: number;
  height: number;
  texts: OfdTextObject[];
  paths: OfdPathObject[];
  lines: OfdLineObject[];
  images: OfdImageObject[];
};

function createOfdSummary(entries: JSZip.JSZipObject[], pages: OfdPagePreview[], images: Map<string, string>): HTMLElement {
  const summary = document.createElement("div");
  summary.className = "ofv-ofd-summary";
  const xmlEntries = entries.filter((entry) => entry.name.endsWith(".xml")).length;
  const textCount = pages.reduce((count, page) => count + page.texts.length, 0);
  const pathCount = pages.reduce((count, page) => count + page.paths.length, 0);
  const lineCount = pages.reduce((count, page) => count + page.lines.length, 0);
  const imageCount = pages.reduce((count, page) => count + page.images.length, 0);
  const textLength = pages.reduce((count, page) => count + page.texts.reduce((inner, item) => inner + item.text.length, 0), 0);
  appendOfdSummary(summary, "文件", String(entries.length));
  appendOfdSummary(summary, "XML", String(xmlEntries));
  appendOfdSummary(summary, "页面", String(pages.length));
  appendOfdSummary(summary, "文本", String(textCount));
  appendOfdSummary(summary, "路径", String(pathCount));
  appendOfdSummary(summary, "线条", String(lineCount));
  appendOfdSummary(summary, "图片对象", String(imageCount));
  appendOfdSummary(summary, "图片资源", String(uniqueOfdImageResources(images)));
  if (textLength > 0) {
    appendOfdSummary(summary, "文字长度", String(textLength));
  }
  const sizes = formatOfdPageSizes(pages);
  if (sizes) {
    appendOfdSummary(summary, "页面尺寸", sizes);
  }
  return summary;
}

function appendOfdSummary(parent: HTMLElement, label: string, value: string): void {
  const item = document.createElement("span");
  const key = document.createElement("span");
  key.textContent = label;
  const content = document.createElement("strong");
  content.textContent = value;
  item.append(key, content);
  parent.append(item);
}

function uniqueOfdImageResources(images: Map<string, string>): number {
  return new Set(images.values()).size;
}

function formatOfdPageSizes(pages: OfdPagePreview[]): string {
  const counts = new Map<string, number>();
  for (const page of pages) {
    const key = `${Math.round(page.width)} x ${Math.round(page.height)}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([size, count]) => (count > 1 ? `${size} (${count})` : size))
    .join(", ");
}

async function readOfdPages(
  entries: JSZip.JSZipObject[],
  images: Map<string, string>
): Promise<OfdPagePreview[]> {
  const pages: OfdPagePreview[] = [];
  const pageEntries = entries
    .filter((entry) => /(^|\/)Pages\/Page_[^/]+\/Content\.xml$/i.test(entry.name) || /(^|\/)Page_[^/]+\/Content\.xml$/i.test(entry.name))
    .slice(0, 80);
  for (const entry of pageEntries) {
    const xml = await entry.async("text");
    const page = parseOfdPage(entry.name, xml, images);
    if (page.texts.length > 0 || page.paths.length > 0 || page.lines.length > 0 || page.images.length > 0) {
      pages.push(page);
    }
  }
  return pages;
}

function parseOfdPage(name: string, xml: string, images: Map<string, string>): OfdPagePreview {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) {
    return { name, width: 210, height: 297, texts: [], paths: [], lines: [], images: [] };
  }
  const pageSize = parseOfdPageSize(doc);
  const textObjects = Array.from(doc.getElementsByTagName("*")).filter((element) => element.localName === "TextObject");
  const texts = textObjects.flatMap((element) => parseOfdTextObject(element));
  const paths = Array.from(doc.getElementsByTagName("*"))
    .filter((element) => element.localName === "PathObject")
    .flatMap((element) => parseOfdPathObject(element));
  const lines = Array.from(doc.getElementsByTagName("*"))
    .filter((element) => element.localName === "LineObject")
    .flatMap((element) => parseOfdLineObject(element));
  const imageObjects = Array.from(doc.getElementsByTagName("*"))
    .filter((element) => element.localName === "ImageObject")
    .flatMap((element) => parseOfdImageObject(element, images));
  const bounds = [
    ...texts.map((item) => ({ x: item.x, y: item.y, width: item.width, height: item.height })),
    ...paths.map((item) => ({ x: item.x, y: item.y, width: item.width, height: item.height })),
    ...lines.map((item) => ({
      x: Math.min(item.x1, item.x2),
      y: Math.min(item.y1, item.y2),
      width: Math.abs(item.x2 - item.x1),
      height: Math.abs(item.y2 - item.y1)
    })),
    ...imageObjects.map((item) => ({ x: item.x, y: item.y, width: item.width, height: item.height }))
  ];
  const width = Math.max(pageSize.width, ...bounds.map((item) => item.x + item.width + 12));
  const height = Math.max(pageSize.height, ...bounds.map((item) => item.y + item.height + 12));
  return { name, width, height, texts, paths, lines, images: imageObjects };
}

function parseOfdTextObject(element: Element): OfdTextObject[] {
  const boundary = parseBoundary(getOfdAttribute(element, "Boundary"));
  const size = finiteNumber(getOfdAttribute(element, "Size"), Math.max(4, boundary.height || 5));
  const color = parseOfdColor(element, "#111827");
  const weight = finiteNumber(getOfdAttribute(element, "Weight"), 400) >= 600 ? "700" : "400";
  const letterSpacing = getOfdAttribute(element, "DeltaX") ? 0.5 : undefined;
  const textCodes = Array.from(element.getElementsByTagName("*")).filter((child) => child.localName === "TextCode");
  if (textCodes.length === 0) {
    return [];
  }
  return textCodes.map((code) => {
    const x = boundary.x + finiteNumber(getOfdAttribute(code, "X"), 0);
    const y = boundary.y + finiteNumber(getOfdAttribute(code, "Y"), 0);
    return {
      text: code.textContent?.trim() || "",
      x,
      y,
      width: boundary.width,
      height: boundary.height,
      size,
      color,
      weight,
      letterSpacing
    };
  }).filter((item) => item.text);
}

function parseOfdPathObject(element: Element): OfdPathObject[] {
  const boundary = parseBoundary(getOfdAttribute(element, "Boundary"));
  const commands = Array.from(element.getElementsByTagName("*")).filter(
    (child) => child.localName === "AbbreviatedData" || child.localName === "PathData"
  );
  const raw = commands.map((child) => child.textContent || "").join(" ").trim();
  if (!raw) {
    return [];
  }
  return [
    {
      d: normalizeOfdPathData(raw),
      x: boundary.x,
      y: boundary.y,
      width: boundary.width,
      height: boundary.height,
      stroke: parseOfdColor(element, "#334155", "StrokeColor"),
      fill: parseOfdFill(element),
      strokeWidth: finiteNumber(getOfdAttribute(element, "LineWidth"), 1)
    }
  ];
}

function parseOfdLineObject(element: Element): OfdLineObject[] {
  const boundary = parseBoundary(getOfdAttribute(element, "Boundary"));
  const start = parsePoint(getOfdAttribute(element, "StartPoint"), { x: 0, y: 0 });
  const end = parsePoint(getOfdAttribute(element, "EndPoint"), {
    x: boundary.width,
    y: boundary.height
  });
  return [
    {
      x1: boundary.x + start.x,
      y1: boundary.y + start.y,
      x2: boundary.x + end.x,
      y2: boundary.y + end.y,
      stroke: parseOfdColor(element, "#334155"),
      strokeWidth: finiteNumber(getOfdAttribute(element, "LineWidth"), 1)
    }
  ];
}

function parseOfdImageObject(element: Element, images: Map<string, string>): OfdImageObject[] {
  const boundary = parseBoundary(getOfdAttribute(element, "Boundary"));
  const resourceId = getOfdAttribute(element, "ResourceID") || getOfdAttribute(element, "ResourceId") || "";
  return [
    {
      x: boundary.x,
      y: boundary.y,
      width: boundary.width || 32,
      height: boundary.height || 32,
      resourceId,
      href: images.get(resourceId)
    }
  ];
}

function renderOfdPage(page: OfdPagePreview): HTMLElement {
  const figure = document.createElement("figure");
  figure.className = "ofv-ofd-page";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${page.width} ${page.height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", page.name);

  const paper = document.createElementNS(svg.namespaceURI, "rect");
  paper.setAttribute("x", "0");
  paper.setAttribute("y", "0");
  paper.setAttribute("width", String(page.width));
  paper.setAttribute("height", String(page.height));
  paper.setAttribute("fill", "white");
  svg.append(paper);

  for (const item of page.images) {
    if (item.href) {
      const image = document.createElementNS(svg.namespaceURI, "image");
      image.setAttribute("x", String(item.x));
      image.setAttribute("y", String(item.y));
      image.setAttribute("width", String(item.width));
      image.setAttribute("height", String(item.height));
      image.setAttribute("href", item.href);
      image.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svg.append(image);
    } else {
      const placeholder = document.createElementNS(svg.namespaceURI, "rect");
      placeholder.setAttribute("x", String(item.x));
      placeholder.setAttribute("y", String(item.y));
      placeholder.setAttribute("width", String(item.width));
      placeholder.setAttribute("height", String(item.height));
      placeholder.setAttribute("fill", "#f8fafc");
      placeholder.setAttribute("stroke", "#94a3b8");
      placeholder.setAttribute("stroke-dasharray", "4 3");
      svg.append(placeholder);
    }
  }

  for (const item of page.paths) {
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute("d", item.d);
    path.setAttribute("transform", `translate(${item.x} ${item.y})`);
    path.setAttribute("fill", item.fill);
    path.setAttribute("stroke", item.stroke);
    path.setAttribute("stroke-width", String(item.strokeWidth));
    svg.append(path);
  }

  for (const item of page.lines) {
    const line = document.createElementNS(svg.namespaceURI, "line");
    line.setAttribute("x1", String(item.x1));
    line.setAttribute("y1", String(item.y1));
    line.setAttribute("x2", String(item.x2));
    line.setAttribute("y2", String(item.y2));
    line.setAttribute("stroke", item.stroke);
    line.setAttribute("stroke-width", String(item.strokeWidth));
    line.setAttribute("stroke-linecap", "round");
    svg.append(line);
  }

  for (const item of page.texts) {
    const text = document.createElementNS(svg.namespaceURI, "text");
    text.setAttribute("x", String(item.x));
    text.setAttribute("y", String(item.y + item.size));
    text.setAttribute("font-size", String(item.size));
    text.setAttribute("fill", item.color);
    text.setAttribute("font-weight", item.weight);
    if (item.letterSpacing !== undefined) {
      text.setAttribute("letter-spacing", String(item.letterSpacing));
    }
    text.textContent = item.text;
    svg.append(text);
  }

  const caption = document.createElement("figcaption");
  caption.textContent = `${page.name} · ${page.texts.length} text · ${page.paths.length} path · ${page.lines.length} line · ${page.images.length} image`;
  figure.append(svg, caption);
  return figure;
}

async function readOfdImages(entries: JSZip.JSZipObject[]): Promise<Map<string, string>> {
  const images = new Map<string, string>();
  for (const entry of entries.filter((item) => /\.(?:png|jpe?g|gif|bmp|webp)$/i.test(item.name)).slice(0, 80)) {
    const id = entry.name.split("/").pop()?.replace(/\.[^.]+$/, "") || entry.name;
    const mimeType = mimeTypeFromPath(entry.name);
    if (!mimeType.startsWith("image/")) {
      continue;
    }
    const base64 = await entry.async("base64");
    const href = `data:${mimeType};base64,${base64}`;
    images.set(id, href);
    images.set(entry.name, href);
    images.set(entry.name.split("/").pop() || entry.name, href);
  }
  return images;
}

function parseOfdPageSize(doc: Document): { width: number; height: number } {
  const physicalBox = Array.from(doc.getElementsByTagName("*")).find((element) => element.localName === "PhysicalBox");
  if (physicalBox?.textContent) {
    const box = parseBoundary(physicalBox.textContent);
    if (box.width > 0 && box.height > 0) {
      return { width: box.width, height: box.height };
    }
  }
  return { width: 210, height: 297 };
}

function parseOfdColor(element: Element, fallback: string, preferredLocalName = "FillColor"): string {
  const colorElement = findOfdChild(element, preferredLocalName) || findOfdChild(element, "StrokeColor") || findOfdChild(element, "FillColor");
  const value = colorElement ? getOfdAttribute(colorElement, "Value") : null;
  if (!value) {
    return fallback;
  }
  const parts = value.trim().split(/\s+/).map((part) => Number(part));
  if (parts.length >= 3 && parts.every((part) => Number.isFinite(part))) {
    return `rgb(${parts.slice(0, 3).map((part) => Math.max(0, Math.min(255, part))).join(" ")})`;
  }
  return fallback;
}

function parseOfdFill(element: Element): string {
  const fillElement = findOfdChild(element, "FillColor");
  return fillElement ? parseOfdColor(element, "transparent", "FillColor") : "transparent";
}

function findOfdChild(element: Element, localName: string): Element | undefined {
  return Array.from(element.children).find((child) => child.localName === localName);
}

function parsePoint(value: string | null, fallback: { x: number; y: number }): { x: number; y: number } {
  const parts = (value || "").trim().split(/\s+/).map((part) => Number(part));
  return {
    x: Number.isFinite(parts[0]) ? parts[0] : fallback.x,
    y: Number.isFinite(parts[1]) ? parts[1] : fallback.y
  };
}

function normalizeOfdPathData(value: string): string {
  return value
    .replace(/\bM\s+/gi, "M ")
    .replace(/\bL\s+/gi, "L ")
    .replace(/\bC\s+/gi, "C ")
    .replace(/\bQ\s+/gi, "Q ")
    .replace(/\bA\s+/gi, "A ")
    .replace(/\bB\s+/gi, "C ")
    .replace(/\bZ\b/gi, "Z")
    .replace(/\s+/g, " ")
    .trim();
}

function mimeTypeFromPath(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    bmp: "image/bmp",
    webp: "image/webp"
  };
  return extension ? map[extension] || "application/octet-stream" : "application/octet-stream";
}

function parseBoundary(value: string | null): { x: number; y: number; width: number; height: number } {
  const parts = (value || "").trim().split(/\s+/).map((part) => Number(part));
  return {
    x: Number.isFinite(parts[0]) ? parts[0] : 0,
    y: Number.isFinite(parts[1]) ? parts[1] : 0,
    width: Number.isFinite(parts[2]) ? parts[2] : 0,
    height: Number.isFinite(parts[3]) ? parts[3] : 0
  };
}

function getOfdAttribute(element: Element, localName: string): string | null {
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

function finiteNumber(value: string | null, fallback: number): number {
  const parsed = value === null ? Number.NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function createOfdFallback(fileName: string, url: string, detail: string): HTMLElement {
  const fallback = document.createElement("div");
  fallback.className = "ofv-fallback";

  const title = document.createElement("strong");
  title.textContent = "OFD 解析失败";

  const meta = document.createElement("span");
  meta.textContent = `${detail}。可下载 ${fileName} 后使用本地 OFD 阅读器查看。`;

  const download = document.createElement("a");
  download.href = url;
  download.download = fileName;
  download.textContent = "下载 OFD";

  fallback.append(title, meta, download);
  return fallback;
}

function normalizeOfdError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "文件可能已损坏，或不是有效的 OFD 包";
}
