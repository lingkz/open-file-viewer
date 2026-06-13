import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@open-file-viewer/core/style.css": fileURLToPath(
        new URL("../../packages/core/src/style.css", import.meta.url)
      ),
      "@open-file-viewer/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url))
    }
  }
});
