import type { PreviewFile } from "../types";

export async function readArrayBuffer(file: PreviewFile): Promise<ArrayBuffer> {
  if (file.source instanceof ArrayBuffer) {
    return file.source;
  }
  if (file.blob) {
    return file.blob.arrayBuffer();
  }
  if (typeof file.source === "string") {
    const response = await fetch(file.source);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status}`);
    }
    return response.arrayBuffer();
  }
  throw new Error("Unsupported file source.");
}

export async function readTextFile(file: PreviewFile): Promise<string> {
  if (typeof file.source === "string") {
    const response = await fetch(file.source);
    if (!response.ok) {
      throw new Error(`Failed to fetch text file: ${response.status}`);
    }
    return response.text();
  }
  if (file.blob) {
    return file.blob.text();
  }
  if (file.source instanceof ArrayBuffer) {
    return new TextDecoder().decode(file.source);
  }
  return String(file.source);
}

export function createPanel(className = ""): HTMLElement {
  const panel = document.createElement("div");
  panel.className = `ofv-panel ${className}`.trim();
  return panel;
}

export function createSection(title: string): HTMLElement {
  const section = document.createElement("section");
  section.className = "ofv-section";
  const heading = document.createElement("h3");
  heading.textContent = title;
  section.append(heading);
  return section;
}

export function appendMeta(parent: HTMLElement, label: string, value: string | number): void {
  const row = document.createElement("div");
  row.className = "ofv-meta-row";
  const key = document.createElement("span");
  key.textContent = label;
  const content = document.createElement("strong");
  content.textContent = String(value);
  row.append(key, content);
  parent.append(row);
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export function resolveFormat(
  file: Pick<PreviewFile, "extension" | "mimeType">,
  mimeMap: Record<string, string>
): string {
  return file.extension || mimeMap[file.mimeType] || "";
}
