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
      if (ctx.options.fallback === "custom" && ctx.options.renderFallback) {
        return ctx.options.renderFallback(ctx);
      }

      const url = createObjectUrl(ctx.file);
      const isExternal = Boolean(ctx.file.url);
      const panel = document.createElement("div");
      panel.className = "ofv-fallback";

      const title = document.createElement("strong");
      title.textContent =
        ctx.options.fallback === "download"
          ? "当前文件可下载后查看"
          : "当前文件暂不支持在线预览";

      const meta = document.createElement("span");
      meta.textContent = ctx.file.name;

      const download = document.createElement("a");
      download.href = url;
      download.download = ctx.file.name;
      download.textContent = "下载文件";

      panel.append(title, meta, download);
      ctx.viewport.classList.add("ofv-center");
      ctx.viewport.append(panel);

      if (ctx.options.fallback === "download") {
        download.focus();
      }

      return {
        destroy() {
          ctx.viewport.classList.remove("ofv-center");
          revokeObjectUrl(url, isExternal);
        }
      };
    }
  };
}
