import { createObjectUrl, revokeObjectUrl } from "../dom";
import type { PreviewPlugin } from "../types";

export function fallbackPlugin(): PreviewPlugin {
  return {
    name: "fallback",
    match() {
      return true;
    },
    render(ctx) {
      ctx.options.onUnsupported?.(ctx.file);
      const url = createObjectUrl(ctx.file);
      const isExternal = Boolean(ctx.file.url);
      const panel = document.createElement("div");
      panel.className = "ofv-fallback";

      const title = document.createElement("strong");
      title.textContent = "当前文件暂不支持在线预览";

      const meta = document.createElement("span");
      meta.textContent = ctx.file.name;

      const download = document.createElement("a");
      download.href = url;
      download.download = ctx.file.name;
      download.textContent = "下载文件";

      panel.append(title, meta, download);
      ctx.viewport.classList.add("ofv-center");
      ctx.viewport.append(panel);

      return {
        destroy() {
          ctx.viewport.classList.remove("ofv-center");
          revokeObjectUrl(url, isExternal);
        }
      };
    }
  };
}
