import {
  archivePlugin,
  audioPlugin,
  cadPlugin,
  drawingPlugin,
  emailPlugin,
  imagePlugin,
  model3dPlugin,
  officePlugin,
  ofdPlugin,
  pdfPlugin,
  textPlugin,
  videoPlugin
} from "@open-file-viewer/core";
import "@open-file-viewer/core/style.css";
import { FileViewer } from "@open-file-viewer/react";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

function App() {
  const [file, setFile] = useState<File | Blob>(
    new Blob(["React adapter demo\n\n选择本地文件后会在自定义容器内预览。"], {
      type: "text/plain"
    })
  );
  const plugins = useMemo(
    () => [
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
    []
  );

  return (
    <main className="demo-shell">
      <header>
        <h1>React File Viewer</h1>
        <input
          type="file"
          onChange={(event) => {
            const next = event.target.files?.[0];
            if (next) {
              setFile(next);
            }
          }}
        />
      </header>
      <FileViewer file={file} fileName={file instanceof File ? file.name : "welcome.txt"} height="70vh" plugins={plugins} />
    </main>
  );
}

createRoot(document.querySelector("#root")!).render(<App />);
