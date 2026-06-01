import { isTextLike } from "../detect";
import type { PreviewPlugin } from "../types";

export function textPlugin(): PreviewPlugin {
  return {
    name: "text",
    match(file) {
      return isTextLike(file);
    },
    async render(ctx) {
      const pre = document.createElement("pre");
      pre.className = "ofv-text";
      pre.textContent = await readText(ctx.file.source);
      ctx.viewport.append(pre);

      return {
        destroy() {
          pre.remove();
        }
      };
    }
  };
}

async function readText(source: unknown): Promise<string> {
  if (typeof source === "string") {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch text file: ${response.status}`);
    }
    return response.text();
  }
  if (source instanceof Blob) {
    return source.text();
  }
  if (source instanceof ArrayBuffer) {
    return new TextDecoder().decode(source);
  }
  return String(source);
}
