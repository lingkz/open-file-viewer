import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createViewer } from "../viewer";
import { epubPlugin } from "./epub";

describe("epubPlugin", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("renders EPUB metadata, spine chapters and embedded images", async () => {
    const container = document.createElement("div");
    document.body.append(container);

    createViewer({
      container,
      file: await createMinimalEpub(),
      fileName: "book.epub",
      plugins: [epubPlugin()]
    });

    await waitFor(() => Boolean(container.querySelector(".ofv-epub-reader")));

    expect(container.textContent).toContain("测试书名");
    expect(container.textContent).toContain("作者 A");
    expect(container.textContent).toContain("第一章");
    expect(container.textContent).toContain("Hello EPUB");
    expect(container.textContent).toContain("第二章");
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")?.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
  });

  it("shows a local fallback for invalid EPUB packages", async () => {
    const container = document.createElement("div");
    const onError = vi.fn();
    document.body.append(container);

    createViewer({
      container,
      file: new Blob(["not a zip"], { type: "application/epub+zip" }),
      fileName: "broken.epub",
      plugins: [epubPlugin()],
      onError
    });

    await waitFor(() => Boolean(container.querySelector(".ofv-fallback")));

    expect(container.textContent).toContain("EPUB 解析失败");
    expect(onError).not.toHaveBeenCalled();
  });
});

async function createMinimalEpub(): Promise<Blob> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?>
    <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
      <rootfiles>
        <rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml" />
      </rootfiles>
    </container>`
  );
  zip.file(
    "OPS/package.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
    <package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
      <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:title>测试书名</dc:title>
        <dc:creator>作者 A</dc:creator>
        <dc:language>zh-CN</dc:language>
      </metadata>
      <manifest>
        <item id="c1" href="chapters/chapter1.xhtml" media-type="application/xhtml+xml" />
        <item id="c2" href="chapters/chapter2.xhtml" media-type="application/xhtml+xml" />
        <item id="cover" href="images/cover.png" media-type="image/png" />
      </manifest>
      <spine>
        <itemref idref="c1" />
        <itemref idref="c2" />
      </spine>
    </package>`
  );
  zip.file(
    "OPS/chapters/chapter1.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
    <html xmlns="http://www.w3.org/1999/xhtml">
      <head><title>第一章</title></head>
      <body>
        <h1>第一章</h1>
        <p>Hello EPUB</p>
        <img src="../images/cover.png" />
        <script>alert(1)</script>
      </body>
    </html>`
  );
  zip.file(
    "OPS/chapters/chapter2.xhtml",
    `<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>第二章</h1><p>Next</p></body></html>`
  );
  zip.file("OPS/images/cover.png", Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return zip.generateAsync({ type: "blob", mimeType: "application/epub+zip" });
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
