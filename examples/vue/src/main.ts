import { createApp, ref } from "vue";
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
import { OpenFileViewer } from "@open-file-viewer/vue";
import type { PreviewTheme } from "@open-file-viewer/vue";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import "./style.css";

const App = {
  components: { OpenFileViewer },
  setup() {
    const file = ref<File | Blob>(
      new Blob(["Vue adapter demo\n\n选择本地文件后会在自定义容器内预览。"], {
        type: "text/plain"
      })
    );
    const theme = ref<PreviewTheme>("light");
    const plugins = [
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
    ];

    return { file, plugins, theme };
  },
  template: `
    <main class="demo-shell">
      <header>
        <h1>Vue File Viewer</h1>
        <input
          type="file"
          @change="event => {
            const next = event.target.files && event.target.files[0]
            if (next) file = next
          }"
        />
        <select v-model="theme">
          <option value="light">light</option>
          <option value="dark">dark</option>
          <option value="auto">auto</option>
        </select>
      </header>
      <OpenFileViewer :file="file" :file-name="file.name || 'welcome.txt'" height="70vh" :plugins="plugins" :theme="theme" toolbar />
    </main>
  `
};

createApp(App).mount("#app");
