import { afterEach, describe, expect, it, vi } from "vitest";
import { createViewer } from "../viewer";
import { textPlugin } from "./text";

describe("textPlugin", () => {
  afterEach(() => {
    document.body.replaceChildren();
    delete (globalThis as { __OFV_MONACO_LOADER__?: unknown }).__OFV_MONACO_LOADER__;
    vi.restoreAllMocks();
  });

  it("sanitizes markdown html before rendering", async () => {
    const container = document.createElement("div");
    document.body.append(container);

    createViewer({
      container,
      file: new Blob(["# Safe\n\n[site](https://example.com)\n\n<img src=x onerror=alert(1)><script>alert(2)</script>"], {
        type: "text/markdown"
      }),
      fileName: "note.md",
      plugins: [textPlugin()]
    });

    await waitFor(() => Boolean(container.querySelector(".ofv-markdown-body")));

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")?.getAttribute("onerror")).toBeNull();
    expect(container.querySelector("a")?.getAttribute("target")).toBe("_blank");
    expect(container.querySelector("a")?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(container.textContent).toContain("Safe");
  });

  it("keeps only safe markdown link protocols", async () => {
    const container = document.createElement("div");
    document.body.append(container);

    createViewer({
      container,
      file: new Blob(["[bad](javascript:alert(1)) [local](./guide.md) [mail](mailto:test@example.com)"], {
        type: "text/markdown"
      }),
      fileName: "links.md",
      plugins: [textPlugin()]
    });

    await waitFor(() => container.querySelectorAll(".ofv-markdown-body a").length === 3);

    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>(".ofv-markdown-body a"));
    expect(links[0].getAttribute("href")).toBeNull();
    expect(links[1].getAttribute("href")).toBe("./guide.md");
    expect(links[2].getAttribute("href")).toBe("mailto:test@example.com");
  });

  it("shows a local fallback when remote text cannot be fetched", async () => {
    const container = document.createElement("div");
    const onError = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: false, status: 404 } as Response))
    );
    document.body.append(container);

    createViewer({
      container,
      file: "https://example.com/missing.txt",
      fileName: "missing.txt",
      plugins: [textPlugin()],
      onError
    });

    await waitFor(() => Boolean(container.querySelector(".ofv-fallback")));

    expect(container.textContent).toContain("文本预览失败");
    expect(container.querySelector<HTMLAnchorElement>(".ofv-fallback a")?.href).toBe("https://example.com/missing.txt");
    expect(onError).not.toHaveBeenCalled();
  });

  it("renders code even when Prism CSS fails to load", async () => {
    const container = document.createElement("div");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    document.body.append(container);

    createViewer({
      container,
      file: new Blob(["const value = 1;"], { type: "text/javascript" }),
      fileName: "sample.js",
      plugins: [textPlugin()]
    });

    const link = await waitFor(() => document.querySelector<HTMLLinkElement>("link[id^='ofv-prism-css']"));
    link.dispatchEvent(new Event("error"));

    await waitFor(() => Boolean(container.querySelector(".ofv-code-container code")));

    expect(container.textContent).toContain("value");
  });

  it("renders code with line numbers and reader actions", async () => {
    const container = document.createElement("div");
    document.body.append(container);

    createViewer({
      container,
      file: new Blob(["const one = 1;\nconst two = 2;"], { type: "text/javascript" }),
      fileName: "sample.mjs",
      plugins: [textPlugin()]
    });

    await waitFor(() => Boolean(container.querySelector(".ofv-code-container code")));

    expect(container.querySelector(".ofv-code-title")?.textContent).toContain("sample.mjs");
    expect(container.querySelector(".ofv-code-title")?.textContent).toContain("javascript");
    expect(container.querySelector(".ofv-code-title")?.textContent).toContain("2 lines");
    expect(container.querySelector(".ofv-code-gutter")?.textContent).toBe("1\n2");
    expect(Array.from(container.querySelectorAll(".ofv-code-action")).map((button) => button.textContent)).toEqual([
      "Editor",
      "Wrap",
      "Copy",
      "Download"
    ]);
  });

  it("switches to an injected Monaco editor and disposes it on destroy", async () => {
    const container = document.createElement("div");
    const disposeEditor = vi.fn();
    const disposeModel = vi.fn();
    const layout = vi.fn();
    const updateOptions = vi.fn();
    const create = vi.fn(() => ({ dispose: disposeEditor, layout, updateOptions }));
    const createModel = vi.fn(() => ({ dispose: disposeModel }));
    const setTheme = vi.fn();
    (globalThis as { __OFV_MONACO_LOADER__?: unknown }).__OFV_MONACO_LOADER__ = vi.fn(async () => ({
      editor: { create, createModel, setTheme }
    }));
    document.body.append(container);

    const viewer = createViewer({
      container,
      file: new Blob(["const value = 1;"], { type: "text/javascript" }),
      fileName: "sample.ts",
      plugins: [textPlugin()]
    });

    await waitFor(() => Boolean(container.querySelector(".ofv-code-container code")));
    const editor = Array.from(container.querySelectorAll<HTMLButtonElement>(".ofv-code-action")).find(
      (button) => button.textContent === "Editor"
    );
    editor?.click();

    await waitFor(() => container.querySelector(".ofv-code-status")?.textContent === "Editor ready");

    expect(createModel).toHaveBeenCalledWith("const value = 1;", "typescript");
    expect(create).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        automaticLayout: true,
        readOnly: true,
        wordWrap: "off"
      })
    );
    expect(setTheme).toHaveBeenCalledWith("vs");
    expect(container.querySelector<HTMLElement>(".ofv-code-body")?.hidden).toBe(true);
    expect(container.querySelector<HTMLElement>(".ofv-code-editor")?.hidden).toBe(false);
    expect(editor?.textContent).toBe("Reader");

    const wrap = Array.from(container.querySelectorAll<HTMLButtonElement>(".ofv-code-action")).find(
      (button) => button.textContent === "Wrap"
    );
    wrap?.click();
    expect(updateOptions).toHaveBeenCalledWith({ wordWrap: "on" });

    editor?.click();
    expect(container.querySelector<HTMLElement>(".ofv-code-body")?.hidden).toBe(false);
    expect(container.querySelector<HTMLElement>(".ofv-code-editor")?.hidden).toBe(true);

    viewer.destroy();
    expect(disposeEditor).toHaveBeenCalledTimes(1);
    expect(disposeModel).toHaveBeenCalledTimes(1);
  });

  it("uses a built-in editor fallback when Monaco loading fails", async () => {
    const container = document.createElement("div");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    (globalThis as { __OFV_MONACO_LOADER__?: unknown }).__OFV_MONACO_LOADER__ = vi.fn(async () => {
      throw new Error("missing Monaco");
    });
    document.body.append(container);

    createViewer({
      container,
      file: new Blob(["body { color: red; }"], { type: "text/css" }),
      fileName: "style.css",
      plugins: [textPlugin()]
    });

    await waitFor(() => Boolean(container.querySelector(".ofv-code-container code")));
    const editor = Array.from(container.querySelectorAll<HTMLButtonElement>(".ofv-code-action")).find(
      (button) => button.textContent === "Editor"
    );
    editor?.click();

    await waitFor(() => container.querySelector(".ofv-code-status")?.textContent === "Basic editor");
    expect(container.querySelector<HTMLElement>(".ofv-code-body")?.hidden).toBe(true);
    expect(container.querySelector<HTMLElement>(".ofv-code-editor")?.hidden).toBe(false);
    expect(container.querySelector<HTMLTextAreaElement>(".ofv-code-editor-fallback")?.value).toContain("color");
  });

  it("copies the full code text from the preview action", async () => {
    const container = document.createElement("div");
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    document.body.append(container);

    createViewer({
      container,
      file: new Blob(["line one\nline two"], { type: "text/plain" }),
      fileName: "notes.txt",
      plugins: [textPlugin()]
    });

    await waitFor(() => Boolean(container.querySelector(".ofv-code-container code")));
    const copy = Array.from(container.querySelectorAll<HTMLButtonElement>(".ofv-code-action")).find(
      (button) => button.textContent === "Copy"
    );
    copy?.click();

    await waitFor(() => writeText.mock.calls.length > 0);
    expect(writeText).toHaveBeenCalledWith("line one\nline two");
    await waitFor(() => container.querySelector(".ofv-code-status")?.textContent === "Copied");
  });

  it("downloads the full text from the preview action", async () => {
    const container = document.createElement("div");
    const createObjectURL = vi.fn(() => "blob:preview");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    document.body.append(container);

    createViewer({
      container,
      file: new Blob(["download me"], { type: "text/plain" }),
      fileName: "download.txt",
      plugins: [textPlugin()]
    });

    await waitFor(() => Boolean(container.querySelector(".ofv-code-container code")));
    const download = Array.from(container.querySelectorAll<HTMLButtonElement>(".ofv-code-action")).find(
      (button) => button.textContent === "Download"
    );
    download?.click();

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview");
    expect(container.querySelector(".ofv-code-status")?.textContent).toBe("Download ready");
  });

  it("limits very large code rendering but keeps the original copy source", async () => {
    const container = document.createElement("div");
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const source = `${"a".repeat(600_000)}TAIL`;
    document.body.append(container);

    createViewer({
      container,
      file: new Blob([source], { type: "text/plain" }),
      fileName: "large.log",
      plugins: [textPlugin()]
    });

    await waitFor(() => Boolean(container.querySelector(".ofv-code-container.is-truncated")));

    expect(container.querySelector(".ofv-code-notice")?.textContent).toContain("文件较大");
    expect(container.querySelector(".ofv-code-container code")?.textContent).not.toContain("TAIL");

    const copy = Array.from(container.querySelectorAll<HTMLButtonElement>(".ofv-code-action")).find(
      (button) => button.textContent === "Copy"
    );
    copy?.click();
    await waitFor(() => writeText.mock.calls.length > 0);
    expect(writeText).toHaveBeenCalledWith(source);
  });
});

async function waitFor<T>(predicate: () => T | false | null | undefined, timeout = 1000): Promise<T> {
  const start = Date.now();
  let result = predicate();
  while (!result) {
    if (Date.now() - start > timeout) {
      throw new Error("Timed out waiting for condition.");
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    result = predicate();
  }
  return result;
}
