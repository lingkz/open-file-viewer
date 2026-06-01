import { createObjectUrl, revokeObjectUrl } from "../dom";
import type { PreviewPlugin, PreviewSize } from "../types";

type PdfJsModule = typeof import("pdfjs-dist");

export interface PdfPluginOptions {
  pdfjs?: PdfJsModule;
  workerSrc?: string;
}

export function pdfPlugin(options: PdfJsModule | PdfPluginOptions = {}): PreviewPlugin {
  return {
    name: "pdf",
    match(file) {
      return file.mimeType === "application/pdf" || file.extension === "pdf";
    },
    async render(ctx) {
      const normalizedOptions = normalizePdfOptions(options);
      const pdf = normalizedOptions.pdfjs || (await import("pdfjs-dist"));
      configurePdfWorker(pdf, normalizedOptions.workerSrc);
      const url = createObjectUrl(ctx.file);
      const isExternal = Boolean(ctx.file.url);
      const scroller = document.createElement("div");
      scroller.className = "ofv-pdf";
      ctx.viewport.append(scroller);

      const documentTask = pdf.getDocument(url);
      const doc = await documentTask.promise;
      const canvases: HTMLCanvasElement[] = [];

      const renderAll = async (size: PreviewSize) => {
        scroller.replaceChildren();
        canvases.length = 0;

        for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
          const page = await doc.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale =
            ctx.options.fit === "actual"
              ? 1
              : Math.max(0.1, Math.min(3, (size.width - 32) / baseViewport.width));
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) {
            throw new Error("Canvas 2D context is not available.");
          }
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.className = "ofv-pdf-page";
          scroller.append(canvas);
          canvases.push(canvas);
          await page.render({ canvasContext: context, viewport }).promise;
        }
      };

      await renderAll(ctx.size);

      let resizeTimer: number | undefined;
      return {
        resize(size) {
          window.clearTimeout(resizeTimer);
          resizeTimer = window.setTimeout(() => {
            void renderAll(size);
          }, 120);
        },
        destroy() {
          window.clearTimeout(resizeTimer);
          canvases.length = 0;
          revokeObjectUrl(url, isExternal);
          void doc.destroy();
        }
      };
    }
  };
}

function normalizePdfOptions(options: PdfJsModule | PdfPluginOptions): PdfPluginOptions {
  if ("getDocument" in options) {
    return { pdfjs: options };
  }
  return options;
}

function configurePdfWorker(pdf: PdfJsModule, workerSrc?: string): void {
  if (workerSrc) {
    pdf.GlobalWorkerOptions.workerSrc = workerSrc;
    return;
  }

  if (!pdf.GlobalWorkerOptions.workerSrc && typeof window !== "undefined") {
    pdf.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdf.version}/build/pdf.worker.mjs`;
  }
}
