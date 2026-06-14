import { describe, expect, it } from "vitest";
import { getExtension, normalizeFile } from "./detect";

describe("detect", () => {
  it("extracts extensions from names and urls", () => {
    expect(getExtension("report.final.DOCX")).toBe("docx");
    expect(getExtension("https://example.com/files/demo.pdf?download=1#page=2")).toBe("pdf");
    expect(getExtension("README")).toBe("");
  });

  it("normalizes ArrayBuffer sources into blobs with inferred mime types", async () => {
    const file = await normalizeFile(new TextEncoder().encode("a,b\n1,2").buffer, "data.tsv");

    expect(file.name).toBe("data.tsv");
    expect(file.extension).toBe("tsv");
    expect(file.mimeType).toBe("text/tab-separated-values");
    expect(file.blob).toBeInstanceOf(Blob);
  });

  it("infers MIME types for common complex preview formats", async () => {
    const docx = await normalizeFile(new ArrayBuffer(1), "letter.docx");
    const docm = await normalizeFile(new ArrayBuffer(1), "macro.docm");
    const zip = await normalizeFile(new ArrayBuffer(1), "bundle.zip");
    const glb = await normalizeFile(new ArrayBuffer(1), "scene.glb");
    const fbx = await normalizeFile(new ArrayBuffer(1), "scene.fbx");
    const ply = await normalizeFile(new ArrayBuffer(1), "scan.ply");
    const drawio = await normalizeFile(new ArrayBuffer(1), "diagram.drawio");
    const topojson = await normalizeFile(new ArrayBuffer(1), "topology.topojson");
    const xlsm = await normalizeFile(new ArrayBuffer(1), "macro.xlsm");
    const xltx = await normalizeFile(new ArrayBuffer(1), "template.xltx");
    const pptm = await normalizeFile(new ArrayBuffer(1), "deck.pptm");
    const potx = await normalizeFile(new ArrayBuffer(1), "deck-template.potx");
    const dxf = await normalizeFile(new ArrayBuffer(1), "drawing.dxf");
    const mkv = await normalizeFile(new ArrayBuffer(1), "movie.mkv");
    const hls = await normalizeFile(new ArrayBuffer(1), "stream.m3u8");

    expect(docx.mimeType).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(docm.mimeType).toBe("application/vnd.ms-word.document.macroenabled.12");
    expect(zip.mimeType).toBe("application/zip");
    expect(glb.mimeType).toBe("model/gltf-binary");
    expect(fbx.mimeType).toBe("application/vnd.autodesk.fbx");
    expect(ply.mimeType).toBe("application/ply");
    expect(drawio.mimeType).toBe("application/vnd.jgraph.mxfile");
    expect(topojson.mimeType).toBe("application/topo+json");
    expect(xlsm.mimeType).toBe("application/vnd.ms-excel.sheet.macroenabled.12");
    expect(xltx.mimeType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.template");
    expect(pptm.mimeType).toBe("application/vnd.ms-powerpoint.presentation.macroenabled.12");
    expect(potx.mimeType).toBe("application/vnd.openxmlformats-officedocument.presentationml.template");
    expect(dxf.mimeType).toBe("image/vnd.dxf");
    expect(mkv.mimeType).toBe("video/x-matroska");
    expect(hls.mimeType).toBe("application/vnd.apple.mpegurl");
  });
});
