import type { PreviewFile, PreviewSource } from "./types";

const extensionMimeMap: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  ico: "image/x-icon",
  tif: "image/tiff",
  tiff: "image/tiff",
  mp4: "video/mp4",
  webm: "video/webm",
  ogg: "video/ogg",
  ogv: "video/ogg",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  aac: "audio/aac",
  m4a: "audio/mp4",
  flac: "audio/flac",
  opus: "audio/opus",
  pdf: "application/pdf",
  txt: "text/plain",
  log: "text/plain",
  json: "application/json",
  xml: "application/xml",
  yaml: "text/yaml",
  yml: "text/yaml",
  csv: "text/csv",
  md: "text/markdown",
  markdown: "text/markdown"
};

export async function normalizeFile(
  source: PreviewSource,
  fileName?: string,
  mimeType?: string
): Promise<PreviewFile> {
  if (typeof source === "string") {
    const name = fileName || source.split("?")[0]?.split("/").pop() || "remote-file";
    const extension = getExtension(name);
    return {
      source,
      name,
      extension,
      mimeType: mimeType || extensionMimeMap[extension] || "",
      url: source
    };
  }

  if (source instanceof File) {
    const extension = getExtension(fileName || source.name);
    return {
      source,
      name: fileName || source.name,
      extension,
      mimeType: mimeType || source.type || extensionMimeMap[extension] || "",
      size: source.size,
      blob: source
    };
  }

  if (source instanceof Blob) {
    const name = fileName || "blob";
    const extension = getExtension(name);
    return {
      source,
      name,
      extension,
      mimeType: mimeType || source.type || extensionMimeMap[extension] || "",
      size: source.size,
      blob: source
    };
  }

  const name = fileName || "buffer";
  const extension = getExtension(name);
  const blob = new Blob([source], { type: mimeType || extensionMimeMap[extension] || "" });
  return {
    source,
    name,
    extension,
    mimeType: blob.type,
    size: blob.size,
    blob
  };
}

export function getExtension(name: string): string {
  const clean = name.split("?")[0]?.split("#")[0] || "";
  const index = clean.lastIndexOf(".");
  return index >= 0 ? clean.slice(index + 1).toLowerCase() : "";
}

export function isTextLike(file: PreviewFile): boolean {
  return (
    file.mimeType.startsWith("text/") ||
    [
      "json",
      "xml",
      "yaml",
      "yml",
      "csv",
      "log",
      "md",
      "markdown",
      "js",
      "ts",
      "tsx",
      "jsx",
      "vue",
      "css",
      "html",
      "htm",
      "java",
      "py",
      "go",
      "rs",
      "php",
      "c",
      "cpp",
      "h",
      "hpp",
      "cs",
      "sql",
      "sh",
      "diff",
      "patch"
    ].includes(file.extension)
  );
}
