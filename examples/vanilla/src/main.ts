import {
  audioPlugin,
  archivePlugin,
  cadPlugin,
  createViewer,
  drawingPlugin,
  emailPlugin,
  imagePlugin,
  model3dPlugin,
  officePlugin,
  ofdPlugin,
  pdfPlugin,
  textPlugin,
  videoPlugin,
  type FileViewer,
  type PreviewFit
} from "@open-file-viewer/core";
import "@open-file-viewer/core/style.css";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import "./style.css";

const container = document.querySelector<HTMLElement>("#viewer")!;
const fileInput = document.querySelector<HTMLInputElement>("#file")!;
const widthInput = document.querySelector<HTMLInputElement>("#width")!;
const heightInput = document.querySelector<HTMLInputElement>("#height")!;
const fitInput = document.querySelector<HTMLSelectElement>("#fit")!;
const applyButton = document.querySelector<HTMLButtonElement>("#apply")!;

let viewer: FileViewer | null = null;
let currentFile: File | string = new Blob(
  [
    `Open File Viewer\n\n请选择一个本地文件。\n\n这个预览器会固定渲染在右侧容器里，不会跳转新窗口。`
  ],
  { type: "text/plain" }
);

function render() {
  viewer?.destroy();
  viewer = createViewer({
    container,
    file: currentFile,
    fileName: currentFile instanceof File ? currentFile.name : "welcome.txt",
    width: widthInput.value,
    height: heightInput.value,
    fit: fitInput.value as PreviewFit,
    plugins: [
      imagePlugin(),
      videoPlugin(),
      audioPlugin(),
      pdfPlugin({ workerSrc: pdfWorkerSrc }),
      officePlugin(),
      ofdPlugin(),
      archivePlugin(),
      emailPlugin(),
      drawingPlugin(),
      cadPlugin(),
      model3dPlugin(),
      textPlugin()
    ],
    onError(error) {
      console.error(error);
    }
  });
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) {
    return;
  }
  currentFile = file;
  render();
});

applyButton.addEventListener("click", render);

render();
