import { createObjectUrl, revokeObjectUrl } from "../dom";
import type { PreviewPlugin } from "../types";

const audioExtensions = new Set([
  "mp3",
  "wav",
  "ogg",
  "oga",
  "aac",
  "m4a",
  "flac",
  "opus",
  "weba",
  "amr",
  "wma"
]);

export function audioPlugin(): PreviewPlugin {
  return {
    name: "audio",
    match(file) {
      return file.mimeType.startsWith("audio/") || audioExtensions.has(file.extension);
    },
    render(ctx) {
      const url = createObjectUrl(ctx.file);
      const isExternal = Boolean(ctx.file.url);
      const wrapper = document.createElement("div");
      wrapper.className = "ofv-audio";

      const title = document.createElement("div");
      title.className = "ofv-audio-title";
      title.textContent = ctx.file.name;

      const audio = document.createElement("audio");
      audio.src = url;
      audio.controls = true;
      audio.preload = "metadata";

      wrapper.append(title, audio);
      ctx.viewport.classList.add("ofv-center");
      ctx.viewport.append(wrapper);

      return {
        destroy() {
          audio.pause();
          ctx.viewport.classList.remove("ofv-center");
          revokeObjectUrl(url, isExternal);
        }
      };
    }
  };
}
