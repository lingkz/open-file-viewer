import JSZip from "jszip";
import type { PreviewPlugin } from "../types";
import { createPanel, createSection, escapeHtml, readArrayBuffer } from "./utils";

export function ofdPlugin(): PreviewPlugin {
  return {
    name: "ofd",
    match(file) {
      return file.extension === "ofd";
    },
    async render(ctx) {
      const panel = createPanel("ofv-ofd");
      ctx.viewport.append(panel);
      const zip = await JSZip.loadAsync(await readArrayBuffer(ctx.file));
      const entries = Object.values(zip.files).filter((entry) => !entry.dir);
      const textFragments: string[] = [];

      for (const entry of entries.filter((item) => item.name.endsWith(".xml")).slice(0, 40)) {
        const xml = await entry.async("text");
        const matches = [...xml.matchAll(/>([^<>]{2,})</g)]
          .map((match) => match[1]?.trim())
          .filter(Boolean) as string[];
        textFragments.push(...matches);
      }

      const section = createSection("OFD 基础预览");
      const note = document.createElement("p");
      note.textContent = "当前版本提取 OFD 包内 XML 文本和文件结构。版式级渲染可在后续接入专用 OFD 渲染器。";
      section.append(note);

      const content = document.createElement("pre");
      content.className = "ofv-text-block";
      content.innerHTML = escapeHtml(textFragments.slice(0, 300).join("\n") || "未提取到可读文本。");
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
        }
      };
    }
  };
}
