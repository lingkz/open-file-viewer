/// <reference path="../shims-text.d.ts" />
import { isTextLike } from "../detect";
import type { PreviewPlugin, PreviewFile } from "../types";

const langMap: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  tsx: "tsx",
  jsx: "jsx",
  html: "markup",
  xml: "markup",
  css: "css",
  scss: "scss",
  less: "less",
  json: "json",
  py: "python",
  java: "java",
  cpp: "cpp",
  c: "c",
  h: "c",
  hpp: "cpp",
  cs: "csharp",
  go: "go",
  rs: "rust",
  sql: "sql",
  sh: "bash",
  yaml: "yaml",
  yml: "yaml",
  diff: "diff",
  patch: "diff",
  php: "php",
  md: "markdown",
  markdown: "markdown"
};

function loadPrismCss(theme: "light" | "dark"): Promise<void> {
  const lightId = "ofv-prism-css-light";
  const darkId = "ofv-prism-css-dark";

  const activeId = theme === "dark" ? darkId : lightId;
  const inactiveId = theme === "dark" ? lightId : darkId;

  document.getElementById(inactiveId)?.remove();

  if (document.getElementById(activeId)) {
    return Promise.resolve();
  }

  const href =
    theme === "dark"
      ? "https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css"
      : "https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism.min.css";

  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.id = activeId;
    link.rel = "stylesheet";
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load Prism CSS: ${href}`));
    document.head.appendChild(link);
  });
}

export function textPlugin(): PreviewPlugin {
  return {
    name: "text",
    match(file) {
      return isTextLike(file);
    },
    async render(ctx) {
      const ext = ctx.file.extension.toLowerCase();
      const isMarkdown = ext === "md" || ext === "markdown";

      // Detect dark theme active state
      const isDark =
        ctx.host.parentElement?.classList.contains("ofv-theme-dark") ||
        document.body.classList.contains("ofv-theme-dark") ||
        (ctx.options.theme === "auto" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) ||
        ctx.options.theme === "dark";

      // 1. Markdown path
      if (isMarkdown) {
        const [markedModule, PrismModule] = await Promise.all([
          import("marked"),
          import("prismjs")
        ]);

        const parseMarkdown =
          markedModule.marked?.parse || markedModule.parse || (markedModule as any).default?.parse;
        const Prism = PrismModule.default || PrismModule;

        const text = await readText(ctx.file.source);
        const container = document.createElement("div");
        container.className = "ofv-markdown-body";
        container.innerHTML = parseMarkdown(text);
        ctx.viewport.appendChild(container);

        // Highlight code blocks inside markdown
        try {
          const codeBlocks = container.querySelectorAll("pre code");
          if (codeBlocks.length > 0) {
            await loadPrismCss(isDark ? "dark" : "light");
            codeBlocks.forEach((block) => {
              const parent = block.parentElement;
              if (parent && !parent.className.includes("language-")) {
                parent.className = "language-none";
              }
              Prism.highlightElement(block);
            });
          }
        } catch (e) {
          console.warn("Prism highlight for markdown failed:", e);
        }

        return {
          destroy() {
            container.remove();
          }
        };
      }

      // 2. Syntax-highlighted code path
      const lang = langMap[ext] || "none";
      const [PrismModule] = await Promise.all([import("prismjs")]);
      const Prism = PrismModule.default || PrismModule;

      // Load specific language component dynamically if needed
      if (lang !== "none") {
        try {
          if (lang === "typescript" || lang === "tsx") {
            await import("prismjs/components/prism-typescript");
          } else if (lang === "python") {
            await import("prismjs/components/prism-python");
          } else if (lang === "json") {
            await import("prismjs/components/prism-json");
          } else if (lang === "yaml") {
            await import("prismjs/components/prism-yaml");
          } else if (lang === "bash") {
            await import("prismjs/components/prism-bash");
          } else if (lang === "csharp") {
            await import("prismjs/components/prism-csharp");
          } else if (lang === "rust") {
            await import("prismjs/components/prism-rust");
          } else if (lang === "go") {
            await import("prismjs/components/prism-go");
          } else if (lang === "sql") {
            await import("prismjs/components/prism-sql");
          } else if (lang === "cpp") {
            await import("prismjs/components/prism-c");
            await import("prismjs/components/prism-cpp");
          } else if (lang === "java") {
            await import("prismjs/components/prism-java");
          } else if (lang === "php") {
            await import("prismjs/components/prism-markup-templating");
            await import("prismjs/components/prism-php");
          }
        } catch (e) {
          console.warn(`Prism failed to load language component for: ${lang}`, e);
        }
      }

      await loadPrismCss(isDark ? "dark" : "light");

      const codeText = await readText(ctx.file.source);
      const wrapper = document.createElement("div");
      wrapper.className = "ofv-code-container";

      const pre = document.createElement("pre");
      pre.className = `language-${lang}`;

      const code = document.createElement("code");
      code.className = `language-${lang}`;
      code.textContent = codeText;

      pre.appendChild(code);
      wrapper.appendChild(pre);
      ctx.viewport.appendChild(wrapper);

      try {
        Prism.highlightElement(code);
      } catch (err) {
        console.error("Prism syntax highlighting failed:", err);
      }

      return {
        destroy() {
          wrapper.remove();
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
