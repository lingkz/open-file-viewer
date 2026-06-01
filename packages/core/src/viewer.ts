import { normalizeFile } from "./detect";
import { applyBoxSize, getElementSize, resolveContainer } from "./dom";
import { fallbackPlugin } from "./plugins/fallback";
import type {
  FileViewer,
  PreviewFile,
  PreviewInstance,
  PreviewOptions,
  PreviewPlugin
} from "./types";

export function createViewer(options: PreviewOptions): FileViewer {
  const container = resolveContainer(options.container);
  applyBoxSize(container, options.width, options.height);

  container.classList.add("ofv-root");
  if (options.className) {
    container.classList.add(options.className);
  }

  const host = document.createElement("div");
  host.className = "ofv-host";

  const status = document.createElement("div");
  status.className = "ofv-status";
  status.hidden = true;

  const viewport = document.createElement("div");
  viewport.className = "ofv-viewport";

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
    currentInstance?.destroy();
    currentInstance = undefined;
    viewport.replaceChildren();
    setLoading(true);

    const plugins = [...(options.plugins || []), fallbackPlugin()];
    const plugin = await findPlugin(plugins, file);

    try {
      currentInstance = await plugin.render({
        host,
        viewport,
        file,
        size: getElementSize(viewport),
        options: normalizedOptions,
        setLoading,
        setError
      });
      setLoading(false);
      options.onLoad?.(file);
      resize();
    } catch (error) {
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
      resizeObserver.disconnect();
      currentInstance?.destroy();
      container.replaceChildren();
      container.classList.remove("ofv-root");
      if (options.className) {
        container.classList.remove(options.className);
      }
    }
  };
}

async function findPlugin(plugins: PreviewPlugin[], file: PreviewFile): Promise<PreviewPlugin> {
  for (const plugin of plugins) {
    if (await plugin.match(file)) {
      return plugin;
    }
  }
  return fallbackPlugin();
}
