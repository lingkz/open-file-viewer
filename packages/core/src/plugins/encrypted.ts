import { createObjectUrl, revokeObjectUrl } from "../dom";
import type { PreviewContext, PreviewFile } from "../types";

export type EncryptedPreviewCopy = {
  title?: string;
  message?: string;
  action?: string;
};

export function createEncryptedPreview(
  ctx: PreviewContext,
  copy: EncryptedPreviewCopy = {}
): { element: HTMLElement; destroy: () => void } {
  const url = createObjectUrl(ctx.file);
  const isExternal = Boolean(ctx.file.url);
  const element = createEncryptedFallback(ctx.file, url, copy);
  return {
    element,
    destroy() {
      revokeObjectUrl(url, isExternal);
    }
  };
}

export function createEncryptedFallback(file: PreviewFile, url: string, copy: EncryptedPreviewCopy = {}): HTMLElement {
  const fallback = document.createElement("div");
  fallback.className = "ofv-fallback ofv-encrypted";

  const title = document.createElement("strong");
  title.textContent = copy.title || "文件已加密，无法在线预览";

  const message = document.createElement("span");
  message.textContent = copy.message || "请下载后在本地输入密码打开，或上传解密后的文件。";

  const meta = document.createElement("dl");
  meta.className = "ofv-fallback-meta ofv-encrypted-meta";
  appendEncryptedMeta(meta, "文件", file.name || "未命名文件");
  appendEncryptedMeta(meta, "格式", file.extension ? `.${file.extension}` : file.mimeType || "未知");

  const download = document.createElement("a");
  download.href = url;
  download.download = file.name;
  download.textContent = copy.action || "下载文件";

  fallback.append(title, message, meta, download);
  return fallback;
}

export function isEncryptedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  const name = typeof error === "object" && error !== null && "name" in error ? String((error as { name?: unknown }).name) : "";
  return /\b(password|encrypted|encrypt|protected|decrypt|permission|加密|密码|受保护)\b/i.test(`${name} ${message}`);
}

function appendEncryptedMeta(parent: HTMLElement, label: string, value: string): void {
  const key = document.createElement("dt");
  key.textContent = label;
  const content = document.createElement("dd");
  content.textContent = value;
  parent.append(key, content);
}
