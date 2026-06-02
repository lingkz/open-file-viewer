import { createObjectUrl, revokeObjectUrl } from "../dom";
import type { PreviewPlugin, PreviewSize } from "../types";

type PdfJsModule = typeof import("pdfjs-dist");

export interface PdfPluginOptions {
  pdfjs?: PdfJsModule;
  workerSrc?: string;
}

// 2D affine transform matrix multiplication helper
function multiplyMatrices(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
  ];
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

      // Fast-extract page dimensions
      const pagesMeta: Array<{ width: number; height: number }> = [];
      for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
        const page = await doc.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        pagesMeta.push({
          width: baseViewport.width,
          height: baseViewport.height
        });
      }

      const pageStates: Array<{
        wrapper: HTMLDivElement;
        canvas: HTMLCanvasElement | null;
        renderTask: any | null;
        rendered: boolean;
      }> = [];

      let observer: IntersectionObserver | null = null;

      // Cancel page rendering and free canvas memory
      const clearPage = (pageIdx: number) => {
        const state = pageStates[pageIdx];
        if (!state || !state.rendered) return;

        if (state.renderTask) {
          try {
            state.renderTask.cancel();
          } catch (e) {
            // Ignore cancel errors
          }
          state.renderTask = null;
        }

        state.canvas = null;
        state.rendered = false;
        state.wrapper.replaceChildren();
        state.wrapper.innerHTML = `<div class="ofv-pdf-skeleton">页面 ${pageIdx + 1} 加载中...</div>`;
      };

      // Perform actual on-demand rendering on canvas and build text layer
      const renderPage = async (pageIdx: number, size: PreviewSize) => {
        const state = pageStates[pageIdx];
        if (!state || state.rendered) return;

        state.rendered = true;

        try {
          const page = await doc.getPage(pageIdx + 1);
          const meta = pagesMeta[pageIdx];
          const scale =
            ctx.options.fit === "actual"
              ? 1
              : Math.max(0.1, Math.min(3, (size.width - 32) / meta.width));
          
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.className = "ofv-pdf-page";
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);

          const context = canvas.getContext("2d");
          if (!context) {
            throw new Error("Canvas 2D context is not available.");
          }

          state.wrapper.replaceChildren(canvas);
          state.canvas = canvas;

          const renderTask = page.render({
            canvasContext: context,
            viewport
          });
          state.renderTask = renderTask;
          
          await renderTask.promise;
          state.renderTask = null;

          // Build absolute-positioned selectable text layer overlay
          const textContent = await page.getTextContent();
          const textLayer = document.createElement("div");
          textLayer.className = "ofv-pdf-text-layer";
          textLayer.style.width = `${Math.floor(viewport.width)}px`;
          textLayer.style.height = `${Math.floor(viewport.height)}px`;
          state.wrapper.appendChild(textLayer);

          for (const item of textContent.items) {
            if (!("str" in item)) continue;
            const str = (item as any).str;
            if (!str.trim()) continue;

            const tx = multiplyMatrices(viewport.transform, (item as any).transform);
            const fontHeight = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);

            const span = document.createElement("span");
            span.textContent = str;
            span.style.fontSize = `${fontHeight}px`;
            span.style.fontFamily = (item as any).fontName || "sans-serif";
            span.style.left = `${tx[4]}px`;
            span.style.top = `${tx[5] - fontHeight}px`;
            span.style.transformOrigin = "0% 0%";

            textLayer.appendChild(span);

            // Scale text width horizontally if specified to match visual width perfectly
            if ((item as any).width) {
              const itemWidth = (item as any).width * scale;
              const actualWidth = span.offsetWidth || span.getBoundingClientRect().width;
              if (actualWidth > 0 && Math.abs(actualWidth - itemWidth) > 1) {
                span.style.transform = `scaleX(${itemWidth / actualWidth})`;
              }
            }
          }
        } catch (err) {
          console.error(`Failed to render PDF page ${pageIdx + 1}:`, err);
          state.rendered = false;
          state.wrapper.innerHTML = `<div class="ofv-pdf-error">无法渲染该页面</div>`;
        }
      };

      const renderLayout = (size: PreviewSize) => {
        observer?.disconnect();
        scroller.replaceChildren();
        pageStates.length = 0;

        observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              const pageIdx = parseInt(entry.target.getAttribute("data-page-index") || "0", 10);
              const state = pageStates[pageIdx];
              if (!state) return;

              if (entry.isIntersecting) {
                if (!state.rendered) {
                  void renderPage(pageIdx, size);
                }
              } else {
                if (state.rendered && doc.numPages > 8) {
                  clearPage(pageIdx);
                }
              }
            });
          },
          {
            root: scroller,
            rootMargin: "400px 0px 400px 0px"
          }
        );

        for (let i = 0; i < doc.numPages; i++) {
          const meta = pagesMeta[i];
          const scale =
            ctx.options.fit === "actual"
              ? 1
              : Math.max(0.1, Math.min(3, (size.width - 32) / meta.width));
          
          const w = Math.floor(meta.width * scale);
          const h = Math.floor(meta.height * scale);

          const wrapper = document.createElement("div");
          wrapper.className = "ofv-pdf-page-wrapper";
          wrapper.setAttribute("data-page-index", String(i));
          wrapper.style.width = `${w}px`;
          wrapper.style.height = `${h}px`;
          wrapper.innerHTML = `<div class="ofv-pdf-skeleton">页面 ${i + 1} 加载中...</div>`;

          scroller.appendChild(wrapper);
          observer.observe(wrapper);

          pageStates.push({
            wrapper,
            canvas: null,
            renderTask: null,
            rendered: false
          });
        }
      };

      renderLayout(ctx.size);

      let resizeTimer: number | undefined;
      return {
        resize(size) {
          window.clearTimeout(resizeTimer);
          resizeTimer = window.setTimeout(() => {
            renderLayout(size);
          }, 120);
        },
        destroy() {
          window.clearTimeout(resizeTimer);
          observer?.disconnect();
          
          pageStates.forEach((state) => {
            if (state.renderTask) {
              try {
                state.renderTask.cancel();
              } catch (e) {
                // Ignore
              }
            }
          });
          pageStates.length = 0;

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
