import JSZip from "jszip";
import type { PreviewPlugin } from "../types";
import { appendMeta, createPanel, createSection, readArrayBuffer } from "./utils";

const archiveExtensions = new Set(["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz"]);

export function archivePlugin(): PreviewPlugin {
  return {
    name: "archive",
    match(file) {
      return archiveExtensions.has(file.extension);
    },
    async render(ctx) {
      const panel = createPanel("ofv-archive");
      ctx.viewport.append(panel);

      if (ctx.file.extension !== "zip") {
        const section = createSection("压缩包预览");
        section.append("当前版本已识别该压缩格式，但浏览器端目录读取优先支持 zip。rar/7z/tar 可在后续接入 WASM 解压器。");
        panel.append(section);
        return { destroy: () => panel.remove() };
      }

      const zip = await JSZip.loadAsync(await readArrayBuffer(ctx.file));
      const entries = Object.values(zip.files);
      const section = createSection("ZIP 文件列表");
      appendMeta(section, "文件数量", entries.filter((entry) => !entry.dir).length);
      appendMeta(section, "目录数量", entries.filter((entry) => entry.dir).length);

      const list = document.createElement("ul");
      list.className = "ofv-file-list";
      for (const entry of entries.slice(0, 500)) {
        const item = document.createElement("li");
        item.textContent = `${entry.dir ? "目录" : "文件"}  ${entry.name}`;
        list.append(item);
      }
      section.append(list);
      panel.append(section);

      return {
        destroy() {
          panel.remove();
        }
      };
    }
  };
}
