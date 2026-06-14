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
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  flv: "video/x-flv",
  wmv: "video/x-ms-wmv",
  "3gp": "video/3gpp",
  m3u8: "application/vnd.apple.mpegurl",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  aac: "audio/aac",
  m4a: "audio/mp4",
  flac: "audio/flac",
  opus: "audio/opus",
  oga: "audio/ogg",
  weba: "audio/webm",
  amr: "audio/amr",
  wma: "audio/x-ms-wma",
  pdf: "application/pdf",
  epub: "application/epub+zip",
  xps: "application/vnd.ms-xpsdocument",
  oxps: "application/oxps",
  txt: "text/plain",
  log: "text/plain",
  json: "application/json",
  xml: "application/xml",
  yaml: "text/yaml",
  yml: "text/yaml",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  md: "text/markdown",
  markdown: "text/markdown",
  toml: "text/plain",
  ini: "text/plain",
  scss: "text/css",
  less: "text/css",
  js: "text/javascript",
  mjs: "text/javascript",
  cjs: "text/javascript",
  ts: "text/typescript",
  tsx: "text/typescript",
  jsx: "text/javascript",
  htm: "text/html",
  html: "text/html",
  vue: "text/plain",
  py: "text/x-python",
  java: "text/x-java-source",
  go: "text/x-go",
  rs: "text/rust",
  php: "application/x-httpd-php",
  c: "text/x-c",
  cpp: "text/x-c++src",
  h: "text/x-c",
  hpp: "text/x-c++hdr",
  cs: "text/x-csharp",
  sql: "application/sql",
  sh: "application/x-sh",
  diff: "text/x-diff",
  patch: "text/x-diff",
  geojson: "application/geo+json",
  topojson: "application/topo+json",
  kml: "application/vnd.google-earth.kml+xml",
  kmz: "application/vnd.google-earth.kmz",
  gpx: "application/gpx+xml",
  shp: "application/octet-stream",
  drawio: "application/vnd.jgraph.mxfile",
  dio: "application/vnd.jgraph.mxfile",
  excalidraw: "application/vnd.excalidraw+json",
  tldraw: "application/json",
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  tar: "application/x-tar",
  gz: "application/gzip",
  tgz: "application/gzip",
  bz2: "application/x-bzip2",
  xz: "application/x-xz",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  docm: "application/vnd.ms-word.document.macroenabled.12",
  dotx: "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
  dotm: "application/vnd.ms-word.template.macroenabled.12",
  dot: "application/msword",
  doc: "application/msword",
  rtf: "application/rtf",
  odt: "application/vnd.oasis.opendocument.text",
  fodt: "application/vnd.oasis.opendocument.text-flat-xml",
  wps: "application/vnd.ms-works",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xltx: "application/vnd.openxmlformats-officedocument.spreadsheetml.template",
  xls: "application/vnd.ms-excel",
  xlsm: "application/vnd.ms-excel.sheet.macroenabled.12",
  xltm: "application/vnd.ms-excel.template.macroenabled.12",
  xlsb: "application/vnd.ms-excel.sheet.binary.macroenabled.12",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  fods: "application/vnd.oasis.opendocument.spreadsheet-flat-xml",
  numbers: "application/vnd.apple.numbers",
  et: "application/vnd.ms-excel",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pptm: "application/vnd.ms-powerpoint.presentation.macroenabled.12",
  ppsx: "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
  ppsm: "application/vnd.ms-powerpoint.slideshow.macroenabled.12",
  potx: "application/vnd.openxmlformats-officedocument.presentationml.template",
  potm: "application/vnd.ms-powerpoint.template.macroenabled.12",
  ppt: "application/vnd.ms-powerpoint",
  pps: "application/vnd.ms-powerpoint",
  odp: "application/vnd.oasis.opendocument.presentation",
  fodp: "application/vnd.oasis.opendocument.presentation-flat-xml",
  key: "application/vnd.apple.keynote",
  dps: "application/vnd.ms-powerpoint",
  eml: "message/rfc822",
  msg: "application/vnd.ms-outlook",
  mbox: "application/mbox",
  ofd: "application/ofd",
  gltf: "model/gltf+json",
  glb: "model/gltf-binary",
  stl: "model/stl",
  obj: "model/obj",
  fbx: "application/vnd.autodesk.fbx",
  dae: "model/vnd.collada+xml",
  ply: "application/ply",
  "3mf": "model/3mf",
  dxf: "image/vnd.dxf",
  dwg: "application/acad",
  dwf: "model/vnd.dwf",
  step: "model/step",
  stp: "model/step",
  iges: "application/iges",
  igs: "application/iges"
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
      "mjs",
      "cjs",
      "ts",
      "tsx",
      "jsx",
      "vue",
      "css",
      "scss",
      "less",
      "html",
      "htm",
      "toml",
      "ini",
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
