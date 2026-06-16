import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte({ hot: false })],
  resolve: {
    conditions: ["browser"],
    alias: {
      "@open-file-viewer/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
      "@open-file-viewer/react": fileURLToPath(new URL("./packages/react/src/index.tsx", import.meta.url)),
      "@open-file-viewer/vue": fileURLToPath(new URL("./packages/vue/src/index.ts", import.meta.url)),
      "@open-file-viewer/svelte": fileURLToPath(new URL("./packages/svelte/src/index.ts", import.meta.url))
    }
  },
  test: {
    environment: "jsdom",
    include: ["packages/**/*.test.ts", "packages/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 10000
  }
});
