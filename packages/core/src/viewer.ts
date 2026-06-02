import { normalizeFile } from "./detect";
import { applyBoxSize, createObjectUrl, getElementSize, resolveContainer, revokeObjectUrl } from "./dom";
import { fallbackPlugin } from "./plugins/fallback";
import type {
  FileViewer,
  PreviewFile,
  PreviewInstance,
  PreviewOptions,
  PreviewPlugin,
  PreviewToolbarOptions
} from "./types";

export function createViewer(options: PreviewOptions): FileViewer {
  const container = resolveContainer(options.container);
  applyBoxSize(container, options.width, options.height);

  container.classList.add("ofv-root");
  if (options.className) {
    container.classList.add(options.className);
  }
  const theme = applyTheme(container, options.theme || "light");

  const host = document.createElement("div");
  host.className = "ofv-host";

  const status = document.createElement("div");
  status.className = "ofv-status";
  status.hidden = true;

  const viewport = document.createElement("div");
  viewport.className = "ofv-viewport";

  const toolbar = createToolbar(options.toolbar, viewport);
  if (toolbar) {
    host.append(toolbar.element);
  }

  host.append(status, viewport);
  container.replaceChildren(host);

  const normalizedOptions = {
    fit: options.fit || "contain",
    fallback: options.fallback || "inline",
    ...options
  };

  let currentFile: PreviewFile | undefined;
  let currentInstance: PreviewInstance | undefined;
  let destroyed = false;
  let renderToken = 0;

  const setLoading = (loading: boolean) => {
    status.hidden = !loading;
    status.textContent = loading ? "Loading preview..." : "";
  };

  const setError = (error: Error | string) => {
    status.hidden = false;
    status.textContent = typeof error === "string" ? error : error.message;
  };

  const resize = () => {
    if (destroyed) {
      return;
    }
    const size = getElementSize(viewport);
    currentInstance?.resize?.(size);
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  const renderFile = async (file: PreviewFile) => {
    const token = (renderToken += 1);
    currentInstance?.destroy();
    currentInstance = undefined;
    viewport.replaceChildren();
    setLoading(true);
    toolbar?.update(file);

    const plugins = [...(options.plugins || []), fallbackPlugin()];
    const plugin = await findPlugin(plugins, file);
    if (destroyed || token !== renderToken) {
      return;
    }

    try {
      const nextInstance = await plugin.render({
        host,
        viewport,
        file,
        size: getElementSize(viewport),
        options: normalizedOptions,
        setLoading,
        setError
      });
      if (destroyed || token !== renderToken) {
        nextInstance.destroy();
        return;
      }
      currentInstance = nextInstance;
      setLoading(false);
      options.onLoad?.(file);
      resize();
    } catch (error) {
      if (destroyed || token !== renderToken) {
        return;
      }
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      setLoading(false);
      setError(normalizedError);
      options.onError?.(normalizedError, file);
    }
  };

  void (async () => {
    currentFile = await normalizeFile(options.file, options.fileName, options.mimeType);
    await renderFile(currentFile);
  })();

  return {
    async reload(file) {
      if (destroyed) {
        return;
      }
      currentFile = await normalizeFile(
        file ?? options.file,
        options.fileName,
        options.mimeType
      );
      await renderFile(currentFile);
    },
    resize,
    destroy() {
      destroyed = true;
      renderToken += 1;
      resizeObserver.disconnect();
      currentInstance?.destroy();
      toolbar?.destroy();
      theme.destroy();
      container.replaceChildren();
      container.classList.remove("ofv-root");
      if (options.className) {
        container.classList.remove(options.className);
      }
    }
  };
}

function applyTheme(
  container: HTMLElement,
  theme: NonNullable<PreviewOptions["theme"]>
): { destroy: () => void } {
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  const classes = ["ofv-theme-light", "ofv-theme-dark"];

  const setThemeClass = () => {
    container.classList.remove(...classes);
    const resolvedTheme = theme === "auto" && media?.matches ? "dark" : theme === "auto" ? "light" : theme;
    container.classList.add(`ofv-theme-${resolvedTheme}`);
  };

  setThemeClass();
  if (theme === "auto") {
    media?.addEventListener("change", setThemeClass);
  }

  return {
    destroy() {
      if (theme === "auto") {
        media?.removeEventListener("change", setThemeClass);
      }
      container.classList.remove(...classes);
    }
  };
}

function createToolbar(
  toolbar: PreviewOptions["toolbar"],
  viewport: HTMLElement
):
  | {
      element: HTMLElement;
      update: (file: PreviewFile) => void;
      destroy: () => void;
    }
  | undefined {
  if (!toolbar) {
    return undefined;
  }

  const options: PreviewToolbarOptions =
    typeof toolbar === "boolean"
      ? { download: true, fullscreen: true, print: true, search: true }
      : toolbar;

  const element = document.createElement("div");
  element.className = "ofv-toolbar";
  element.setAttribute("role", "toolbar");
  element.setAttribute("aria-label", "File preview toolbar");

  let file: PreviewFile | undefined;
  const disposers: Array<() => void> = [];
  const search = createSearchController(viewport);

  const addButton = (label: string, title: string, action: () => void) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.addEventListener("click", action);
    element.append(button);
    disposers.push(() => button.removeEventListener("click", action));
  };

  if (options.download !== false) {
    addButton("Download", "Download file", () => {
      if (file) {
        downloadFile(file);
      }
    });
  }

  if (options.fullscreen !== false) {
    addButton("Fullscreen", "Open preview fullscreen", () => {
      const target = element.parentElement;
      void target?.requestFullscreen?.();
    });
  }

  if (options.print) {
    addButton("Print", "Print preview", () => {
      printPreview(viewport);
    });
  }

  if (options.search !== false) {
    const searchGroup = document.createElement("label");
    searchGroup.className = "ofv-toolbar-search";
    searchGroup.title = "Search preview text";
    const searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.placeholder = "Search";
    searchInput.setAttribute("aria-label", "Search preview text");
    const searchCount = document.createElement("span");
    searchCount.className = "ofv-toolbar-search-count";

    const runSearch = () => {
      const count = search.search(searchInput.value);
      searchCount.textContent = searchInput.value ? String(count) : "";
    };

    searchInput.addEventListener("input", runSearch);
    searchGroup.append(searchInput, searchCount);
    element.append(searchGroup);
    disposers.push(() => searchInput.removeEventListener("input", runSearch));
  }

  return {
    element,
    update(nextFile) {
      file = nextFile;
      search.clear();
    },
    destroy() {
      search.clear();
      for (const dispose of disposers) {
        dispose();
      }
    }
  };
}

function createSearchController(root: HTMLElement): {
  search: (query: string) => number;
  clear: () => void;
} {
  const markerClass = "ofv-search-match";

  const clear = () => {
    const markers = [...root.querySelectorAll(`mark.${markerClass}`)];
    for (const marker of markers) {
      marker.replaceWith(document.createTextNode(marker.textContent || ""));
    }
    root.normalize();
  };

  const search = (query: string): number => {
    clear();
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return 0;
    }

    const textNodes = collectSearchableTextNodes(root);
    let count = 0;
    let firstMatch: HTMLElement | undefined;

    for (const node of textNodes) {
      const text = node.nodeValue || "";
      const lowerText = text.toLowerCase();
      const lowerQuery = normalizedQuery.toLowerCase();
      let start = 0;
      let index = lowerText.indexOf(lowerQuery, start);
      if (index < 0) {
        continue;
      }

      const fragment = document.createDocumentFragment();
      while (index >= 0) {
        if (index > start) {
          fragment.append(document.createTextNode(text.slice(start, index)));
        }
        const marker = document.createElement("mark");
        marker.className = markerClass;
        marker.textContent = text.slice(index, index + normalizedQuery.length);
        fragment.append(marker);
        firstMatch ||= marker;
        count += 1;
        start = index + normalizedQuery.length;
        index = lowerText.indexOf(lowerQuery, start);
      }
      if (start < text.length) {
        fragment.append(document.createTextNode(text.slice(start)));
      }
      node.replaceWith(fragment);
    }

    firstMatch?.scrollIntoView({ block: "center", inline: "nearest" });
    return count;
  };

  return { search, clear };
}

function collectSearchableTextNodes(root: HTMLElement): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || !node.nodeValue?.trim()) {
        return NodeFilter.FILTER_REJECT;
      }
      if (["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "BUTTON"].includes(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  return nodes;
}

function printPreview(viewport: HTMLElement): void {
  const frame = document.createElement("iframe");
  frame.className = "ofv-print-frame";
  frame.setAttribute("aria-hidden", "true");
  document.body.append(frame);

  const clone = viewport.cloneNode(true) as HTMLElement;
  copyCanvasContent(viewport, clone);
  clone.classList.add("ofv-print-root");

  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }

  doc.open();
  doc.write(`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Print preview</title>
        <style>
          * { box-sizing: border-box; }
          html, body {
            margin: 0;
            padding: 0;
            background: #fff;
            color: #111827;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          body { padding: 16px; }
          img, video, canvas, svg { max-width: 100%; }
          pre {
            white-space: pre-wrap;
            word-break: break-word;
            font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          }
          .ofv-viewport, .ofv-print-root {
            width: 100%;
            height: auto;
            overflow: visible;
            background: #fff;
            color: #111827;
          }
          .ofv-pdf {
            padding: 0;
            overflow: visible;
            background: #fff;
          }
          .ofv-pdf-page {
            display: block;
            max-width: 100%;
            height: auto;
            margin: 0 auto 16px;
            box-shadow: none;
          }
          .ofv-panel,
          .ofv-text,
          .ofv-text-block,
          .ofv-file-list {
            max-height: none;
            min-height: 0;
            overflow: visible;
          }
          .ofv-section {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        </style>
      </head>
      <body></body>
    </html>`);
  doc.close();
  doc.body.append(clone);

  let printed = false;
  const printAndCleanup = () => {
    if (printed) {
      return;
    }
    printed = true;
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1000);
  };

  frame.onload = () => {
    printAndCleanup();
  };

  window.setTimeout(() => {
    printAndCleanup();
  }, 100);
}

function copyCanvasContent(sourceRoot: HTMLElement, targetRoot: HTMLElement): void {
  const sourceCanvases = [...sourceRoot.querySelectorAll("canvas")];
  const targetCanvases = [...targetRoot.querySelectorAll("canvas")];

  sourceCanvases.forEach((sourceCanvas, index) => {
    const targetCanvas = targetCanvases[index];
    if (!targetCanvas) {
      return;
    }
    const image = document.createElement("img");
    image.className = targetCanvas.className;
    image.alt = "Canvas preview page";
    try {
      image.src = sourceCanvas.toDataURL("image/png");
    } catch {
      return;
    }
    image.width = sourceCanvas.width;
    image.height = sourceCanvas.height;
    targetCanvas.replaceWith(image);
  });
}

function downloadFile(file: PreviewFile): void {
  const url = createObjectUrl(file);
  const isExternal = Boolean(file.url);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.rel = "noopener";
  link.click();
  window.setTimeout(() => revokeObjectUrl(url, isExternal), 0);
}

async function findPlugin(plugins: PreviewPlugin[], file: PreviewFile): Promise<PreviewPlugin> {
  for (const plugin of plugins) {
    if (await plugin.match(file)) {
      return plugin;
    }
  }
  return fallbackPlugin();
}
