import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createViewer } from "../viewer";
import { pdfPlugin } from "./pdf";

describe("pdfPlugin", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("renders pages without IntersectionObserver support", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);

    const container = createSizedContainer();
    const pdfjs = createPdfJsMock();
    const viewer = createViewer({
      container,
      file: new Blob(["pdf"], { type: "application/pdf" }),
      fileName: "legacy.pdf",
      plugins: [pdfPlugin({ pdfjs })]
    });

    await waitFor(() => container.querySelectorAll("canvas.ofv-pdf-page").length === 2);

    expect(container.querySelector(".ofv-pdf-skeleton")).toBeNull();

    viewer.destroy();
  });

  it("lays out PDF pages and responds to zoom commands", async () => {
    const container = createSizedContainer();
    const objectUrl = "blob:ofv-pdf";
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => objectUrl),
      revokeObjectURL: vi.fn()
    });

    const pdfjs = createPdfJsMock();
    const viewer = createViewer({
      container,
      file: new Blob(["pdf"], { type: "application/pdf" }),
      fileName: "sample.pdf",
      toolbar: true,
      plugins: [pdfPlugin({ pdfjs })]
    });

    await waitFor(() => container.querySelectorAll(".ofv-pdf-page-wrapper").length === 2);

    const firstWrapper = container.querySelector<HTMLElement>(".ofv-pdf-page-wrapper");
    const zoomIn = container.querySelector<HTMLButtonElement>('button[aria-label="Zoom in"]');
    const rotate = container.querySelector<HTMLButtonElement>('button[aria-label="Rotate right"]');

    expect(zoomIn?.disabled).toBe(false);
    expect(rotate?.disabled).toBe(true);

    zoomIn?.click();

    await waitFor(() => container.querySelector<HTMLElement>(".ofv-pdf-page-wrapper") !== firstWrapper);

    expect(container.querySelectorAll(".ofv-pdf-page-wrapper")).toHaveLength(2);
    expect(pdfjs.GlobalWorkerOptions.workerSrc).toContain("pdf.worker.mjs");

    viewer.destroy();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(objectUrl);
  });

  it("shows a local fallback when the PDF document cannot be loaded", async () => {
    const container = createSizedContainer();
    const objectUrl = "blob:ofv-bad-pdf";
    const onError = vi.fn();
    const destroyTask = vi.fn();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => objectUrl),
      revokeObjectURL: vi.fn()
    });
    const pdfjs = {
      version: "4.0.0-test",
      GlobalWorkerOptions: { workerSrc: "" },
      getDocument: vi.fn(() => ({
        promise: Promise.reject(Object.assign(new Error("Password required"), { name: "PasswordException" })),
        destroy: destroyTask
      }))
    };

    const viewer = createViewer({
      container,
      file: new Blob(["pdf"], { type: "application/pdf" }),
      fileName: "locked.pdf",
      plugins: [pdfPlugin({ pdfjs: pdfjs as any })],
      onError
    });

    await waitFor(() => Boolean(container.querySelector(".ofv-fallback")));

    expect(container.textContent).toContain("PDF 预览失败");
    expect(container.textContent).toContain("密码保护");
    expect(container.querySelector<HTMLAnchorElement>(".ofv-fallback a")?.href).toBe(objectUrl);
    expect(onError).not.toHaveBeenCalled();

    viewer.destroy();
    expect(destroyTask).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(objectUrl);
  });

  it("keeps laying out a PDF when page metadata probing fails", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const container = createSizedContainer();
    const page = createPdfPageMock();
    const pdfjs = {
      version: "4.0.0-test",
      GlobalWorkerOptions: { workerSrc: "" },
      getDocument: vi.fn(() => ({
        promise: Promise.resolve({
          numPages: 2,
          getPage: vi.fn((pageNumber: number) =>
            pageNumber === 1 ? Promise.reject(new Error("metadata failed")) : Promise.resolve(page)
          ),
          destroy: vi.fn()
        })
      }))
    };

    const viewer = createViewer({
      container,
      file: new Blob(["pdf"], { type: "application/pdf" }),
      fileName: "partial.pdf",
      plugins: [pdfPlugin({ pdfjs: pdfjs as any })]
    });

    await waitFor(() => container.querySelectorAll(".ofv-pdf-page-wrapper").length === 2);
    await waitFor(() => Boolean(container.querySelector(".ofv-pdf-error")));

    expect(container.querySelectorAll(".ofv-pdf-page-wrapper")).toHaveLength(2);
    expect(container.querySelector(".ofv-pdf-error")?.textContent).toContain("无法渲染该页面");

    viewer.destroy();
  });
});

function createPdfJsMock(): any {
  const page = createPdfPageMock();

  return {
    version: "4.0.0-test",
    GlobalWorkerOptions: { workerSrc: "" },
    getDocument: vi.fn(() => ({
      promise: Promise.resolve({
        numPages: 2,
        getPage: vi.fn(() => Promise.resolve(page)),
        destroy: vi.fn()
      })
    }))
  };
}

function createPdfPageMock(): any {
  return {
    getViewport({ scale }: { scale: number }) {
      return {
        width: 400 * scale,
        height: 600 * scale,
        transform: [scale, 0, 0, scale, 0, 0]
      };
    },
    render() {
      return {
        promise: Promise.resolve(),
        cancel: vi.fn()
      };
    },
    getTextContent() {
      return Promise.resolve({ items: [] });
    }
  };
}

function createSizedContainer(): HTMLDivElement {
  const container = document.createElement("div");
  vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    toJSON: () => ({})
  } as DOMRect);
  document.body.append(container);
  return container;
}

async function waitFor(predicate: () => boolean, timeout = 1000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeout) {
      throw new Error("Timed out waiting for condition.");
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
