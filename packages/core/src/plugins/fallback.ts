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

      const meta = createFallbackMeta(ctx.file);

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

function createFallbackMeta(file: { name: string; extension: string; mimeType: string; size?: number; url?: string }): HTMLElement {
  const meta = document.createElement("dl");
  meta.className = "ofv-fallback-meta";
  appendFallbackMeta(meta, "文件", file.name || "未命名文件");
  appendFallbackMeta(meta, "格式", file.extension ? `.${file.extension}` : "未知");
  appendFallbackMeta(meta, "MIME", file.mimeType || "未声明");
  appendFallbackMeta(meta, "大小", file.size === undefined ? "未知" : formatFallbackBytes(file.size));
  appendFallbackMeta(meta, "来源", file.url ? "远程 URL" : "本地/内存文件");
  return meta;
}

function appendFallbackMeta(parent: HTMLElement, label: string, value: string): void {
  const key = document.createElement("dt");
  key.textContent = label;
  const content = document.createElement("dd");
  content.textContent = value;
  parent.append(key, content);
}

function formatFallbackBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
