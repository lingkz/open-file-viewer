import { createObjectUrl, revokeObjectUrl } from "../dom";
import type { PreviewPlugin } from "../types";

const videoExtensions = new Set([
  "mp4",
  "webm",
  "ogg",
  "ogv",
  "mov",
  "m4v",
  "avi",
  "mkv",
  "flv",
  "wmv",
  "3gp",
  "ts",
  "m3u8"
]);

export function videoPlugin(): PreviewPlugin {
  return {
    name: "video",
    match(file) {
      return file.mimeType.startsWith("video/") || videoExtensions.has(file.extension);
    },
    render(ctx) {
      const url = createObjectUrl(ctx.file);
      const isExternal = Boolean(ctx.file.url);
      const video = document.createElement("video");
      video.className = "ofv-media";
      video.src = url;
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.style.objectFit = ctx.options.fit === "cover" ? "cover" : "contain";

      ctx.viewport.classList.add("ofv-center");
      ctx.viewport.append(video);

      return {
        resize() {
          video.style.width = "100%";
          video.style.height = "100%";
        },
        destroy() {
          video.pause();
          ctx.viewport.classList.remove("ofv-center");
          revokeObjectUrl(url, isExternal);
        }
      };
    }
  };
}
