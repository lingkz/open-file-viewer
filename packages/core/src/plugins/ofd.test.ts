import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createViewer } from "../viewer";
import { ofdPlugin } from "./ofd";

describe("ofdPlugin", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("extracts XML text and file structure from OFD packages", async () => {
    const zip = new JSZip();
    zip.file(
      "Doc_0/Pages/Page_0/Content.xml",
      `<ofd:Page xmlns:ofd="http://www.ofdspec.org/2016">
        <ofd:Content>
          <ofd:Layer>
            <ofd:TextObject Boundary="20 30 120 16" Size="12">
              <ofd:TextCode X="0" Y="0">发票标题</ofd:TextCode>
            </ofd:TextObject>
            <ofd:TextObject Boundary="20 56 120 16" Size="10">
              <ofd:TextCode X="0" Y="0">金额 100</ofd:TextCode>
            </ofd:TextObject>
          </ofd:Layer>
        </ofd:Content>
      </ofd:Page>`
    );
    zip.file("Doc_0/Res/image.dat", "data");
    const buffer = await zip.generateAsync({ type: "arraybuffer" });

    const container = document.createElement("div");
    document.body.append(container);

    createViewer({
      container,
      file: buffer,
      fileName: "invoice.ofd",
      plugins: [ofdPlugin()]
    });

    await waitFor(() => container.textContent?.includes("发票标题") === true);

    const summary = container.querySelector(".ofv-ofd-summary");
    expect(summary?.textContent).toContain("文件2");
    expect(summary?.textContent).toContain("XML1");
    expect(summary?.textContent).toContain("页面1");
    expect(summary?.textContent).toContain("文本2");
    expect(summary?.textContent).toContain("文字长度10");
    expect(summary?.textContent).toContain("页面尺寸210 x 297");
    expect(container.textContent).toContain("发票标题");
    expect(container.textContent).toContain("金额 100");
    expect(container.textContent).toContain("Content.xml");
    expect(container.textContent).toContain("文件结构 2");
    expect(container.querySelector(".ofv-ofd-pages svg")).not.toBeNull();
    expect(container.querySelector(".ofv-ofd-page text")?.getAttribute("x")).toBe("20");
    expect(container.querySelector(".ofv-ofd-page text")?.getAttribute("y")).toBe("42");
    expect(container.querySelector(".ofv-ofd-page figcaption")?.textContent).toContain("2 text");
  });

  it("renders lightweight OFD vector layout with paths, lines, images and text styles", async () => {
    const zip = new JSZip();
    zip.file(
      "Doc_0/Pages/Page_0/Content.xml",
      `<ofd:Page xmlns:ofd="http://www.ofdspec.org/2016">
        <ofd:Area>
          <ofd:PhysicalBox>0 0 120 160</ofd:PhysicalBox>
        </ofd:Area>
        <ofd:Content>
          <ofd:Layer>
            <ofd:PathObject Boundary="10 10 60 30" LineWidth="2">
              <ofd:FillColor Value="240 249 255"/>
              <ofd:StrokeColor Value="37 99 235"/>
              <ofd:AbbreviatedData>M 0 0 L 60 0 L 60 30 L 0 30 Z</ofd:AbbreviatedData>
            </ofd:PathObject>
            <ofd:LineObject Boundary="10 50 80 0" StartPoint="0 0" EndPoint="80 0" LineWidth="1.5">
              <ofd:StrokeColor Value="220 38 38"/>
            </ofd:LineObject>
            <ofd:ImageObject Boundary="10 64 32 24" ResourceID="img1"/>
            <ofd:TextObject Boundary="10 100 90 16" Size="12" Weight="700" DeltaX="1">
              <ofd:FillColor Value="22 163 74"/>
              <ofd:TextCode X="0" Y="0">彩色文本</ofd:TextCode>
            </ofd:TextObject>
          </ofd:Layer>
        </ofd:Content>
      </ofd:Page>`
    );
    zip.file("Doc_0/Res/img1.png", "pngdata");
    const buffer = await zip.generateAsync({ type: "arraybuffer" });

    const container = document.createElement("div");
    document.body.append(container);

    createViewer({
      container,
      file: buffer,
      fileName: "layout.ofd",
      plugins: [ofdPlugin()]
    });

    await waitFor(() => Boolean(container.querySelector(".ofv-ofd-pages svg")));

    const svg = container.querySelector(".ofv-ofd-pages svg");
    const summary = container.querySelector(".ofv-ofd-summary");
    expect(summary?.textContent).toContain("页面1");
    expect(summary?.textContent).toContain("文本1");
    expect(summary?.textContent).toContain("路径1");
    expect(summary?.textContent).toContain("线条1");
    expect(summary?.textContent).toContain("图片对象1");
    expect(summary?.textContent).toContain("图片资源1");
    expect(summary?.textContent).toContain("页面尺寸120 x 160");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 120 160");
    expect(svg?.querySelector("path")?.getAttribute("d")).toBe("M 0 0 L 60 0 L 60 30 L 0 30 Z");
    expect(svg?.querySelector("path")?.getAttribute("transform")).toBe("translate(10 10)");
    expect(svg?.querySelector("path")?.getAttribute("fill")).toBe("rgb(240 249 255)");
    expect(svg?.querySelector("line")?.getAttribute("stroke")).toBe("rgb(220 38 38)");
    expect(svg?.querySelector("image")?.getAttribute("href")).toContain("data:image/png;base64,");
    expect(svg?.querySelector("text")?.getAttribute("fill")).toBe("rgb(22 163 74)");
    expect(svg?.querySelector("text")?.getAttribute("font-weight")).toBe("700");
    expect(svg?.querySelector("text")?.getAttribute("letter-spacing")).toBe("0.5");
    expect(container.querySelector(".ofv-ofd-page figcaption")?.textContent).toContain("1 path");
    expect(container.querySelector(".ofv-ofd-page figcaption")?.textContent).toContain("1 line");
    expect(container.querySelector(".ofv-ofd-page figcaption")?.textContent).toContain("1 image");
  });

  it("shows a local fallback for invalid OFD packages", async () => {
    const onError = vi.fn();
    const objectUrl = "blob:broken-ofd";
    vi.spyOn(URL, "createObjectURL").mockReturnValue(objectUrl);

    const container = document.createElement("div");
    document.body.append(container);

    createViewer({
      container,
      file: new Blob(["not a zip"], { type: "application/ofd" }),
      fileName: "broken.ofd",
      plugins: [ofdPlugin()],
      onError
    });

    await waitFor(() => Boolean(container.querySelector(".ofv-fallback")));

    expect(container.textContent).toContain("OFD 解析失败");
    expect(container.textContent).toContain("broken.ofd");
    expect(container.querySelector<HTMLAnchorElement>(".ofv-fallback a")?.href).toBe(objectUrl);
    expect(onError).not.toHaveBeenCalled();
  });
});

async function waitFor(predicate: () => boolean, timeout = 1000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeout) {
      throw new Error("Timed out waiting for condition.");
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
