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
    const summary = container.querySelector(".ofv-xps-summary");
    expect(summary?.textContent).toContain("页面1");
    expect(summary?.textContent).toContain("文件6");
    expect(summary?.textContent).toContain("FixedDocument1");
    expect(summary?.textContent).toContain("FixedDocSeq1");
    expect(summary?.textContent).toContain("关系文件1");
    expect(summary?.textContent).toContain("资源2");
    expect(summary?.textContent).toContain("图片资源1");
    expect(summary?.textContent).toContain("字体资源1");
    expect(summary?.textContent).toContain("Glyphs2");
    expect(summary?.textContent).toContain("800 x 600");
    expect(summary?.textContent).toContain("ImageBrush 1");
    expect(summary?.textContent).toContain("Canvas 1");
    expect(summary?.textContent).toContain("Path 1");
    expect(container.textContent).toContain("Hello XPS");
    expect(container.textContent).toContain("金额 100");
    expect(container.textContent).toContain("页面1.fpage");
    expect(container.textContent).toContain("文件结构 6");
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
      <Canvas>
        <Path Data="M 0,0 L 10,10" />
      </Canvas>
      <ImageBrush ImageSource="../Resources/image.png" />
      <Glyphs UnicodeString="Hello XPS" />
      <Glyphs UnicodeString="金额 100" />
    </FixedPage>`
  );
  zip.file("Documents/1/Resources/image.png", Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]));
  zip.file("Documents/1/Resources/font.odttf", Uint8Array.from([0, 1, 0, 0]));
  zip.file("Documents/1/FixedDoc.fdoc", "<FixedDocument />");
  zip.file("Documents/1/_rels/FixedDoc.fdoc.rels", "<Relationships />");
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
