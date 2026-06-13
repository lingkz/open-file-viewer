import JSZip from "jszip";
import type { WorkBook } from "xlsx";
import type { PreviewPlugin } from "../types";
import { createPanel, createSection, escapeHtml, readArrayBuffer } from "./utils";

const wordExtensions = new Set(["docx", "doc", "dotx", "dot", "rtf", "odt", "fodt", "wps"]);
const sheetExtensions = new Set(["xlsx", "xls", "xlsm", "xlsb", "csv", "tsv", "ods", "fods", "numbers", "et"]);
const presentationExtensions = new Set(["pptx", "ppt", "pps", "ppsx", "odp", "fodp", "key", "dps"]);

export function officePlugin(): PreviewPlugin {
  return {
    name: "office",
    match(file) {
      return (
        wordExtensions.has(file.extension) ||
        sheetExtensions.has(file.extension) ||
        presentationExtensions.has(file.extension)
      );
    },
    async render(ctx) {
      const panel = createPanel("ofv-office");
      ctx.viewport.append(panel);

      if (fileIsDocx(ctx.file.extension)) {
        await renderDocx(panel, await readArrayBuffer(ctx.file));
      } else if (ctx.file.extension === "rtf") {
        renderPlainDocument(panel, "RTF 文档", rtfToText(await readTextFromBuffer(await readArrayBuffer(ctx.file))));
      } else if (ctx.file.extension === "odt") {
        await renderOdt(panel, await readArrayBuffer(ctx.file));
      } else if (ctx.file.extension === "fodt") {
        renderOpenDocumentXml(panel, "FODT 文档", await readTextFromBuffer(await readArrayBuffer(ctx.file)));
      } else if (sheetExtensions.has(ctx.file.extension)) {
        await renderSheet(panel, await readArrayBuffer(ctx.file), ctx.file.extension);
      } else if (ctx.file.extension === "pptx" || ctx.file.extension === "ppsx") {
        await renderPptx(panel, await readArrayBuffer(ctx.file));
      } else if (ctx.file.extension === "odp") {
        await renderOdp(panel, await readArrayBuffer(ctx.file));
      } else if (ctx.file.extension === "fodp") {
        renderOpenDocumentPresentationXml(panel, await readTextFromBuffer(await readArrayBuffer(ctx.file)));
      } else {
        renderUnsupportedOffice(panel, ctx.file.extension);
      }

      return {
        destroy() {
          panel.remove();
        }
      };
    }
  };
}

function fileIsDocx(extension: string): boolean {
  return extension === "docx" || extension === "dotx";
}

async function renderDocx(panel: HTMLElement, arrayBuffer: ArrayBuffer): Promise<void> {
  const mammoth = await import("mammoth");
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => ({
        src: `data:${image.contentType};base64,${await image.read("base64")}`
      }))
    }
  );
  const section = createSection("Word 文档");
  const content = document.createElement("article");
  content.className = "ofv-document";
  content.innerHTML = result.value || "<p>未解析到可展示内容。</p>";
  section.append(content);

  if (result.messages.length > 0) {
    const notes = document.createElement("details");
    notes.className = "ofv-details";
    notes.innerHTML = `<summary>解析提示 ${result.messages.length}</summary>`;
    const list = document.createElement("ul");
    for (const message of result.messages) {
      const item = document.createElement("li");
      item.textContent = message.message;
      list.append(item);
    }
    notes.append(list);
    section.append(notes);
  }

  panel.append(section);

  const zip = await JSZip.loadAsync(arrayBuffer);
  await Promise.all([
    renderDocxSupplement(panel, zip, /^word\/header\d*\.xml$/, "页眉"),
    renderDocxSupplement(panel, zip, /^word\/footer\d*\.xml$/, "页脚"),
    renderDocxSupplement(panel, zip, /^word\/comments\d*\.xml$/, "批注")
  ]);
}

async function renderDocxSupplement(
  panel: HTMLElement,
  zip: JSZip,
  pattern: RegExp,
  title: string
): Promise<void> {
  const entries = Object.values(zip.files).filter((entry) => pattern.test(entry.name));
  const fragments: string[] = [];
  for (const entry of entries) {
    const xml = await entry.async("text");
    fragments.push(...extractOpenXmlText(xml));
  }
  if (fragments.length === 0) {
    return;
  }
  const section = createSection(`Word ${title}`);
  const content = document.createElement("div");
  content.className = "ofv-document-extra";
  content.textContent = fragments.join("\n");
  section.append(content);
  panel.append(section);
}

async function renderOdt(panel: HTMLElement, arrayBuffer: ArrayBuffer): Promise<void> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const content = zip.file("content.xml");
  if (!content) {
    renderPlainDocument(panel, "ODT 文档", "未找到 content.xml。");
    return;
  }
  renderOpenDocumentXml(panel, "ODT 文档", await content.async("text"));
}

function renderOpenDocumentXml(panel: HTMLElement, title: string, xml: string): void {
  const section = createSection(title);
  const article = document.createElement("article");
  article.className = "ofv-document";
  const blocks = extractOpenDocumentBlocks(xml);
  article.innerHTML =
    blocks.length > 0
      ? blocks.map((block) => `<p>${escapeHtml(block)}</p>`).join("")
      : "<p>未提取到可展示文本。</p>";
  section.append(article);
  panel.append(section);
}

function renderPlainDocument(panel: HTMLElement, title: string, text: string): void {
  const section = createSection(title);
  const pre = document.createElement("pre");
  pre.className = "ofv-text-block";
  pre.textContent = text || "未提取到可展示文本。";
  section.append(pre);
  panel.append(section);
}

async function renderSheet(
  panel: HTMLElement,
  arrayBuffer: ArrayBuffer,
  extension: string
): Promise<void> {
  const xlsx = await import("xlsx");
  const workbook = xlsx.read(arrayBuffer, { type: "array" }) as WorkBook;
  const tabs = document.createElement("div");
  tabs.className = "ofv-tabs";
  const content = document.createElement("div");
  content.className = "ofv-sheet";
  const buttons = new Map<string, HTMLButtonElement>();

  const renderSheetByName = (sheetName: string) => {
    content.replaceChildren();
    buttons.forEach((button, name) => {
      button.classList.toggle("is-active", name === sheetName);
    });

    const heading = document.createElement("h3");
    heading.textContent = sheetName;
    const sheet = workbook.Sheets[sheetName];
    const range = xlsx.utils.decode_range(sheet["!ref"] || "A1:A1");
    const rowCount = range.e.r - range.s.r + 1;
    const columnCount = range.e.c - range.s.c + 1;
    const formulaRows = collectFormulaRows(sheet, range, xlsx.utils.encode_cell);

    const summary = document.createElement("div");
    summary.className = "ofv-sheet-summary";
    summary.textContent = `${rowCount} 行 x ${columnCount} 列${
      formulaRows.length > 0 ? `，包含 ${formulaRows.length} 个公式单元格` : ""
    }`;

    const html = xlsx.utils.sheet_to_html(sheet, { id: `ofv-sheet-${sheetName}` });
    const tableWrapper = document.createElement("div");
    tableWrapper.className = "ofv-table-scroll";
    tableWrapper.innerHTML = html;
    annotateSheetTable(tableWrapper, range, formulaRows);
    content.append(heading, summary, tableWrapper);

    if (formulaRows.length > 0) {
      const details = document.createElement("details");
      details.className = "ofv-details ofv-formula-list";
      details.innerHTML = `<summary>公式明细</summary>`;
      const list = document.createElement("ul");
      for (const item of formulaRows.slice(0, 200)) {
        const row = document.createElement("li");
        row.textContent = `${item.address}: ${item.formula}`;
        list.append(row);
      }
      if (formulaRows.length > 200) {
        const row = document.createElement("li");
        row.textContent = `还有 ${formulaRows.length - 200} 个公式未展示。`;
        list.append(row);
      }
      details.append(list);
      content.append(details);
    }
  };

  if (workbook.SheetNames.length === 0) {
    content.textContent = extension === "numbers" ? "Numbers 文件需要服务端转换后高保真预览。" : "未解析到表格。";
  } else {
    for (const [index, sheetName] of workbook.SheetNames.entries()) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = sheetName;
      button.addEventListener("click", () => renderSheetByName(sheetName));
      buttons.set(sheetName, button);
      tabs.append(button);
      if (index === 0) {
        renderSheetByName(sheetName);
      }
    }
  }

  panel.append(tabs, content);
}

function collectFormulaRows(
  sheet: Record<string, any>,
  range: { s: { r: number; c: number }; e: { r: number; c: number } },
  encodeCell: (cell: { r: number; c: number }) => string
): Array<{ address: string; formula: string }> {
  const formulas: Array<{ address: string; formula: string }> = [];
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const address = encodeCell({ r: row, c: column });
      const cell = sheet[address];
      if (cell?.f) {
        formulas.push({ address, formula: `=${cell.f}` });
      }
    }
  }
  return formulas;
}

function annotateSheetTable(
  tableWrapper: HTMLElement,
  range: { s: { r: number; c: number } },
  formulas: Array<{ address: string; formula: string }>
): void {
  const table = tableWrapper.querySelector("table");
  if (!table) {
    return;
  }

  const formulaMap = new Map(formulas.map((item) => [item.address, item.formula]));
  const rows = Array.from(table.rows);
  rows.forEach((row, rowIndex) => {
    Array.from(row.cells).forEach((cell, columnIndex) => {
      const address = encodeA1(rowIndex + range.s.r, columnIndex + range.s.c);
      cell.dataset.cell = address;
      const formula = formulaMap.get(address);
      if (formula) {
        cell.classList.add("ofv-cell-formula");
        cell.title = formula;
      }
    });
  });
}

function encodeA1(rowIndex: number, columnIndex: number): string {
  let column = "";
  let value = columnIndex + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }
  return `${column}${rowIndex + 1}`;
}

async function renderPptx(panel: HTMLElement, arrayBuffer: ArrayBuffer): Promise<void> {
  const { PptxViewer } = await import("@aiden0z/pptx-renderer");
  const container = document.createElement("div");
  container.className = "ofv-pptx-viewer";
  panel.append(container);
  try {
    await PptxViewer.open(arrayBuffer, container);
  } catch {
    container.textContent = "PPTX 渲染失败，请检查文件是否损坏。";
  }
}

async function renderOdp(panel: HTMLElement, arrayBuffer: ArrayBuffer): Promise<void> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const content = zip.file("content.xml");
  if (!content) {
    panel.textContent = "未解析到 ODP 内容。";
    return;
  }
  const xml = await content.async("text");
  const images = await extractZipImages(zip, /^Pictures\//);
  renderOpenDocumentPresentation(panel, "ODP 演示文稿", xml, images);
}

function renderOpenDocumentPresentationXml(panel: HTMLElement, xml: string): void {
  renderOpenDocumentPresentation(panel, "FODP 演示文稿", xml, []);
}

function renderOpenDocumentPresentation(
  panel: HTMLElement,
  title: string,
  xml: string,
  images: Array<{ name: string; src: string }>
): void {
  const pages = xml.split(/<draw:page\b/).slice(1);
  const pageSources = pages.length > 0 ? pages : [xml];
  for (const [index, pageXml] of pageSources.entries()) {
    const section = createSection(`${title} ${index + 1}`);
    const body = document.createElement("div");
    body.className = "ofv-slide";
    const texts = extractOpenDocumentBlocks(pageXml);
    const textHtml =
      texts.length > 0 ? texts.map((text) => `<p>${escapeHtml(text)}</p>`).join("") : "<p>这一页没有可提取文本。</p>";
    const imageHtml = images
      .slice(index === 0 ? 0 : images.length, index === 0 ? images.length : images.length)
      .map(
        (image) =>
          `<figure class="ofv-slide-image"><img src="${image.src}" alt="${escapeHtml(image.name)}" /><figcaption>${escapeHtml(image.name)}</figcaption></figure>`
      )
      .join("");
    body.innerHTML = `${textHtml}${imageHtml}`;
    section.append(body);
    panel.append(section);
  }
}

function renderUnsupportedOffice(panel: HTMLElement, extension: string): void {
  const legacyBinary = new Set(["doc", "dot", "wps", "ppt", "pps", "key", "dps"]);
  const message = legacyBinary.has(extension)
    ? "该格式属于老二进制或专有格式，浏览器内无法可靠解析；建议接入 LibreOffice/OnlyOffice 服务端转换为 PDF/HTML 后预览。"
    : "该格式通常需要服务端转换或专用解析器才能高保真预览。";
  panel.innerHTML = `
    <section class="ofv-section">
      <h3>Office 基础预览</h3>
      <p><strong>.${escapeHtml(extension)}</strong> 已进入 Office 插件。${message}</p>
      <p>当前版本优先支持 docx、rtf、odt/fodt、xlsx/xls/csv/ods、pptx/ppsx、odp/fodp 的基础内容预览。</p>
    </section>
  `;
}


async function extractZipImages(
  zip: JSZip,
  pattern: RegExp
): Promise<Array<{ name: string; src: string }>> {
  const images: Array<{ name: string; src: string }> = [];
  for (const entry of Object.values(zip.files).filter((item) => !item.dir && pattern.test(item.name))) {
    const mimeType = mimeTypeFromPath(entry.name);
    if (!mimeType.startsWith("image/")) {
      continue;
    }
    images.push({
      name: entry.name.split("/").pop() || entry.name,
      src: `data:${mimeType};base64,${await entry.async("base64")}`
    });
  }
  return images;
}

function extractOpenXmlText(xml: string): string[] {
  return [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>|<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => decodeXml(match[1] || match[2] || "").trim())
    .filter(Boolean);
}

function extractOpenDocumentBlocks(xml: string): string[] {
  return [...xml.matchAll(/<(?:text:p|text:h)[^>]*>([\s\S]*?)<\/(?:text:p|text:h)>/g)]
    .map((match) => stripXmlTags(match[1] || ""))
    .map((text) => decodeXml(text).trim())
    .filter(Boolean);
}

function stripXmlTags(value: string): string {
  return value
    .replace(/<text:line-break\s*\/>/g, "\n")
    .replace(/<text:tab\s*\/>/g, "\t")
    .replace(/<[^>]+>/g, "");
}

function rtfToText(rtf: string): string {
  return rtf
    .replace(/\\'[0-9a-fA-F]{2}/g, "")
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\tab/g, "\t")
    .replace(/\\[a-zA-Z]+\d* ?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function readTextFromBuffer(arrayBuffer: ArrayBuffer): Promise<string> {
  return new TextDecoder("utf-8", { fatal: false }).decode(arrayBuffer);
}


function mimeTypeFromPath(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    webp: "image/webp"
  };
  return extension ? map[extension] || "application/octet-stream" : "application/octet-stream";
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}
