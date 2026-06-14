import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PreviewPlugin } from "@open-file-viewer/core";
import { FileViewer } from "./index";

describe("FileViewer React adapter", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("recreates the core viewer when plugins change", async () => {
    const firstDestroy = vi.fn();
    const secondDestroy = vi.fn();
    const firstPlugin = createPlugin("first", firstDestroy);
    const secondPlugin = createPlugin("second", secondDestroy);

    const { rerender, unmount } = render(
      <FileViewer file={new Blob(["demo"], { type: "text/plain" })} fileName="demo.txt" plugins={[firstPlugin]} />
    );

    expect(await screen.findByText("first:demo.txt")).toBeTruthy();

    rerender(
      <FileViewer file={new Blob(["demo"], { type: "text/plain" })} fileName="demo.txt" plugins={[secondPlugin]} />
    );

    await waitFor(() => expect(firstDestroy).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("second:demo.txt")).toBeTruthy();

    unmount();
    expect(secondDestroy).toHaveBeenCalledTimes(1);
  });

  it("passes fallback callbacks through to the core viewer", async () => {
    const unsupported = vi.fn();

    render(
      <FileViewer
        file={new Blob(["unknown"], { type: "application/octet-stream" })}
        fileName="unknown.bin"
        fallback="inline"
        onUnsupported={unsupported}
      />
    );

    await waitFor(() => expect(unsupported).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("当前文件暂不支持在线预览")).toBeTruthy();
  });

  it("passes className through as the core viewer style hook", async () => {
    const destroy = vi.fn();
    const { container, unmount } = render(
      <FileViewer
        file={new Blob(["demo"], { type: "text/plain" })}
        fileName="demo.txt"
        plugins={[createPlugin("styled", destroy)]}
        className="viewer-shell"
      />
    );

    expect(await screen.findByText("styled:demo.txt")).toBeTruthy();

    const root = container.firstElementChild as HTMLElement;
    expect(root.classList.contains("viewer-shell")).toBe(true);
    expect(root.classList.contains("ofv-root")).toBe(true);

    unmount();
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(root.classList.contains("viewer-shell")).toBe(false);
  });
});

function createPlugin(name: string, destroy: () => void): PreviewPlugin {
  return {
    name,
    match: () => true,
    render(ctx) {
      const element = document.createElement("div");
      element.textContent = `${name}:${ctx.file.name}`;
      ctx.viewport.append(element);
      return { destroy };
    }
  };
}
