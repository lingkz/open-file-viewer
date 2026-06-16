import type { PreviewOptions, PreviewToolbarRenderContext } from "@open-file-viewer/core";

export type OpenFileViewerProps = Omit<PreviewOptions, "container" | "toolbar"> & {
  className?: string;
  toolbar?: PreviewOptions["toolbar"];
  renderToolbar?: (ctx: PreviewToolbarRenderContext) => HTMLElement | void;
};
