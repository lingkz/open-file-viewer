import type { PreviewSize } from "./types";

export function resolveContainer(container: HTMLElement | string): HTMLElement {
  if (typeof container !== "string") {
    return container;
  }

  const element = document.querySelector<HTMLElement>(container);
  if (!element) {
    throw new Error(`File viewer container not found: ${container}`);
  }
  return element;
}

export function applyBoxSize(
  element: HTMLElement,
  width?: number | string,
  height?: number | string
): void {
  if (width !== undefined) {
    element.style.width = typeof width === "number" ? `${width}px` : width;
  }
  if (height !== undefined) {
    element.style.height = typeof height === "number" ? `${height}px` : height;
  }
}

export function getElementSize(element: HTMLElement): PreviewSize {
  const rect = element.getBoundingClientRect();
  return {
    width: Math.max(0, Math.round(rect.width)),
    height: Math.max(0, Math.round(rect.height))
  };
}

export function createObjectUrl(file: { url?: string; blob?: Blob }): string {
  if (file.url) {
    return file.url;
  }
  if (!file.blob) {
    throw new Error("File source cannot be converted to an object URL.");
  }
  return URL.createObjectURL(file.blob);
}

export function revokeObjectUrl(url: string, isExternal: boolean): void {
  if (!isExternal) {
    URL.revokeObjectURL(url);
  }
}
