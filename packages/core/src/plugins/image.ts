import { createObjectUrl, revokeObjectUrl } from "../dom";
import type { PreviewPlugin, PreviewSize } from "../types";

const imageExtensions = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "avif",
  "svg",
  "bmp",
  "ico",
  "tif",
  "tiff",
  "apng",
  "heic",
  "heif"
]);

export function imagePlugin(): PreviewPlugin {
  return {
    name: "image",
    match(file) {
      return file.mimeType.startsWith("image/") || imageExtensions.has(file.extension);
    },
    render(ctx) {
      const url = createObjectUrl(ctx.file);
      const isExternal = Boolean(ctx.file.url);
      const image = document.createElement("img");
      image.className = "ofv-media";
      image.alt = ctx.file.name;
      image.draggable = false;
      image.src = url;
      image.style.objectFit = objectFit(ctx.options.fit);

      ctx.viewport.classList.add("ofv-center");
      ctx.viewport.append(image);

      return {
        resize(size: PreviewSize) {
          image.style.maxWidth = `${size.width}px`;
          image.style.maxHeight = `${size.height}px`;
        },
        destroy() {
          ctx.viewport.classList.remove("ofv-center");
          revokeObjectUrl(url, isExternal);
        }
      };
    }
  };
}

function objectFit(fit: string): string {
  if (fit === "cover") {
    return "cover";
  }
  if (fit === "actual") {
    return "none";
  }
  if (fit === "scale-down") {
    return "scale-down";
  }
  return "contain";
}
