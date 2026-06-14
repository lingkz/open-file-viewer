import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createViewer } from "../viewer";
import { xpsPlugin } from "./xps";

describe("xpsPlugin", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("renders FixedPage text and package structure from XPS files", async () => {
    const container = document.createElement("div");
    document.body.append(container);

    createViewer({
      container,
      file: await createMinimalXps(),
      fileName: "report.xps",
      plugins: [xpsPlugin()]
    });

    await waitFor(() => Boolean(container.querySelector(".ofv-xps-pages")));

    expect(container.textContent).toContain("XPS 基础预览");
    expect(container.textContent).toContain("Hello XPS");
    expect(container.textContent).toContain("金额 100");
    expect(container.textContent).toContain("页面1.fpage");
    expect(container.textContent).toContain("文件结构 3");
    expect(container.querySelectorAll(".ofv-xps-page")).toHaveLength(1);
  });

  it("shows a local fallback for invalid XPS packages", async () => {
    const container = document.createElement("div");
    const onError = vi.fn();
    document.body.append(container);

    createViewer({
      container,
      file: new Blob(["not a zip"], { type: "application/vnd.ms-xpsdocument" }),
      fileName: "broken.xps",
      plugins: [xpsPlugin()],
      onError
    });

    await waitFor(() => Boolean(container.querySelector(".ofv-fallback")));

    expect(container.textContent).toContain("XPS 解析失败");
    expect(onError).not.toHaveBeenCalled();
  });
});

async function createMinimalXps(): Promise<Blob> {
  const zip = new JSZip();
  zip.file(
    "Documents/1/Pages/页面1.fpage",
    `<FixedPage xmlns="http://schemas.microsoft.com/xps/2005/06" Width="800" Height="600">
      <Glyphs UnicodeString="Hello XPS" />
      <Glyphs UnicodeString="金额 100" />
    </FixedPage>`
  );
  zip.file("Documents/1/Resources/image.png", Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]));
  zip.file("FixedDocSeq.fdseq", "<FixedDocumentSequence />");
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.ms-xpsdocument" });
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
