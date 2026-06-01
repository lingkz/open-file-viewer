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
      } else if (sheetExtensions.has(ctx.file.extension)) {
        await renderSheet(panel, await readArrayBuffer(ctx.file), ctx.file.extension);
      } else if (ctx.file.extension === "pptx" || ctx.file.extension === "ppsx") {
        await renderPptx(panel, await readArrayBuffer(ctx.file));
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
  const result = await mammoth.convertToHtml({ arrayBuffer });
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

  const renderSheetByName = (sheetName: string) => {
    content.replaceChildren();
    const heading = document.createElement("h3");
    heading.textContent = sheetName;
    const sheet = workbook.Sheets[sheetName];
    const html = xlsx.utils.sheet_to_html(sheet, { id: `ofv-sheet-${sheetName}` });
    const tableWrapper = document.createElement("div");
    tableWrapper.className = "ofv-table-scroll";
    tableWrapper.innerHTML = html;
    content.append(heading, tableWrapper);
  };

  if (workbook.SheetNames.length === 0) {
    content.textContent = extension === "numbers" ? "Numbers 文件需要服务端转换后高保真预览。" : "未解析到表格。";
  } else {
    for (const [index, sheetName] of workbook.SheetNames.entries()) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = sheetName;
      button.addEventListener("click", () => renderSheetByName(sheetName));
      tabs.append(button);
      if (index === 0) {
        renderSheetByName(sheetName);
      }
    }
  }

  panel.append(tabs, content);
}

async function renderPptx(panel: HTMLElement, arrayBuffer: ArrayBuffer): Promise<void> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const slideEntries = Object.values(zip.files)
    .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  if (slideEntries.length === 0) {
    panel.textContent = "未解析到 PPTX 幻灯片内容。";
    return;
  }

  for (const [index, entry] of slideEntries.entries()) {
    const xml = await entry.async("text");
    const texts = [...xml.matchAll(/<a:t>(.*?)<\/a:t>/g)].map((match) =>
      decodeXml(match[1] || "")
    );
    const slide = createSection(`Slide ${index + 1}`);
    const body = document.createElement("div");
    body.className = "ofv-slide";
    body.innerHTML =
      texts.length > 0
        ? texts.map((text) => `<p>${escapeHtml(text)}</p>`).join("")
        : "<p>这一页没有可提取文本。</p>";
    slide.append(body);
    panel.append(slide);
  }
}

function renderUnsupportedOffice(panel: HTMLElement, extension: string): void {
  panel.innerHTML = `
    <section class="ofv-section">
      <h3>Office 基础预览</h3>
      <p><strong>.${escapeHtml(extension)}</strong> 已进入 Office 插件，但该格式通常需要服务端转换或专用解析器才能高保真预览。</p>
      <p>当前版本优先支持 docx、xlsx/xls/csv/ods、pptx 的基础内容预览。</p>
    </section>
  `;
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}
