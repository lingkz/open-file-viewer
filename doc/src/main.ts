import {
  audioPlugin,
  archivePlugin,
  cadPlugin,
  createViewer,
  drawingPlugin,
  emailPlugin,
  epubPlugin,
  imagePlugin,
  model3dPlugin,
  gisPlugin,
  officePlugin,
  ofdPlugin,
  pdfPlugin,
  textPlugin,
  videoPlugin,
  type FileViewer,
  type PreviewFit,
  type PreviewTheme,
  xpsPlugin
} from "@open-file-viewer/core";
import "@open-file-viewer/core/style.css";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import "./style.css";

type Language = "zh" | "en";
type SiteTheme = "dark" | "light";
type Route = "/" | "/api" | "/frameworks" | "/formats" | "/cases" | "/playground";
type CodeTab = "vanilla" | "react" | "vue";

interface DemoFile {
  label: Record<Language, string>;
  file: File;
}

interface ApiRow {
  name: string;
  type: string;
  description: Record<Language, string>;
}

const routes: Route[] = ["/", "/api", "/frameworks", "/formats", "/cases", "/playground"];

const translations: Record<Language, Record<string, string>> = {
  zh: {
    "nav.home": "首页",
    "nav.api": "API",
    "nav.frameworks": "框架",
    "nav.formats": "格式",
    "nav.cases": "案例",
    "nav.playground": "在线使用",
    "hero.eyebrow": "文件预览 SDK",
    "hero.title": "Open File Viewer",
    "hero.lede":
      "兼容原生 JavaScript、React 和 Vue 的浏览器文件预览库。用一个稳定容器承载 PDF、Office、图片、音视频、压缩包、邮件、图纸、3D 和 GIS。",
    "hero.primary": "在线体验",
    "hero.secondary": "查看 API",
    "hero.native": "无框架也能接入",
    "hero.react": "组件式附件预览",
    "hero.vue": "组合式项目友好",
    "home.whyEyebrow": "为什么选择它",
    "home.whyTitle": "专为产品内嵌预览设计",
    "home.whyDesc":
      "它不是一个简单 demo，而是一套可持续扩展的预览基础设施：插件协议、工具栏、主题、多文件队列、错误降级和框架适配都已经成型。",
    "features.card1.title": "容器优先",
    "features.card1.desc": "所有内容渲染在你传入的 DOM 容器里，不跳窗口，不打断业务页面。",
    "features.card2.title": "插件化格式支持",
    "features.card2.desc": "每类文件由独立插件负责，后续接入专用渲染器或服务端转换更清晰。",
    "features.card3.title": "三端接入",
    "features.card3.desc": "原生 JS、React、Vue 共用 core 能力，设计系统和业务代码都能稳定复用。",
    "features.card4.title": "可测试降级",
    "features.card4.desc": "坏文件和浏览器不支持时给出局部提示、下载入口和清晰错误边界。",
    "api.eyebrow": "API 文档",
    "api.title": "从 createViewer 开始",
    "api.desc": "核心 API 保持克制：容器、文件、插件、尺寸、主题和事件回调。复杂格式能力由插件扩展。",
    "api.nav.options": "PreviewOptions",
    "api.nav.instance": "FileViewer",
    "api.nav.plugin": "Plugin Protocol",
    "api.pluginTitle": "自定义插件协议",
    "api.pluginDesc": "插件只需要实现 match 和 render。render 收到 PreviewContext，并返回可销毁的 PreviewInstance。",
    "frameworks.eyebrow": "框架接入",
    "frameworks.title": "原生 JS、React、Vue 一套核心",
    "frameworks.desc": "根据项目栈选择入口。底层插件能力一致，方便团队在多个产品里复用同一套预览策略。",
    "formats.eyebrow": "格式矩阵",
    "formats.title": "覆盖常见附件、文档和工程文件",
    "formats.desc": "不同格式会处在不同能力层级：原生预览、基础解析、结构展示、占位识别或下载 fallback。",
    "cases.eyebrow": "应用案例",
    "cases.title": "嵌入真实业务流",
    "cases.desc": "预览不是孤立页面，而是列表、审批、客服、网盘、知识库、工程资料中心里的关键交互。",
    "cases.card1.title": "知识库与网盘",
    "cases.card1.desc": "文件列表、详情页、全文搜索结果中直接预览附件，减少下载和跳转。",
    "cases.card2.title": "审批与合同",
    "cases.card2.desc": "PDF、Word、Excel、OFD、邮件附件在同一容器中查看，适合企业流程系统。",
    "cases.card3.title": "工程资料中心",
    "cases.card3.desc": "CAD、3D、GIS、压缩包结构预览帮助工程团队快速判断文件内容。",
    "cases.card4.title": "SaaS 附件中心",
    "cases.card4.desc": "在 CRM、工单、项目管理里复用统一预览体验，减少格式碎片化成本。",
    "playground.eyebrow": "在线使用",
    "playground.title": "把文件拖进来，马上预览",
    "playground.desc": "本地文件只在浏览器内读取，不会上传。也可以使用内置示例体验 Markdown、JSON、SVG、DXF。",
    "playground.dropTitle": "选择或拖入文件",
    "playground.dropDesc": "支持多文件队列预览",
    "playground.sample": "内置示例",
    "playground.width": "宽度",
    "playground.height": "高度",
    "playground.fit": "适配",
    "playground.viewerTheme": "预览主题",
    "playground.apply": "应用设置",
    "playground.current": "当前文件",
    "footer.text": "面向现代 Web 产品的容器优先文件预览 SDK。"
  },
  en: {
    "nav.home": "Home",
    "nav.api": "API",
    "nav.frameworks": "Frameworks",
    "nav.formats": "Formats",
    "nav.cases": "Use cases",
    "nav.playground": "Playground",
    "hero.eyebrow": "File preview SDK",
    "hero.title": "Open File Viewer",
    "hero.lede":
      "A browser file preview library for vanilla JavaScript, React and Vue. Render PDF, Office, images, media, archives, email, drawings, 3D and GIS files inside one stable container.",
    "hero.primary": "Try playground",
    "hero.secondary": "Read API",
    "hero.native": "Works without a framework",
    "hero.react": "Component-ready previews",
    "hero.vue": "Composition-friendly integration",
    "home.whyEyebrow": "Why it exists",
    "home.whyTitle": "Built for embedded product previews",
    "home.whyDesc":
      "This is more than a demo. It is an extensible preview foundation with plugin contracts, toolbar, themes, multi-file queues, tested fallbacks and framework adapters.",
    "features.card1.title": "Container-first",
    "features.card1.desc": "Everything renders inside your DOM container, without opening new windows or disrupting product layouts.",
    "features.card2.title": "Plugin format support",
    "features.card2.desc": "Each file family is isolated in a plugin, making future renderers and conversion services easier to add.",
    "features.card3.title": "Three entry points",
    "features.card3.desc": "Vanilla JS, React and Vue share the same core, so teams can reuse one preview strategy.",
    "features.card4.title": "Testable fallback",
    "features.card4.desc": "Unsupported browsers and corrupted files stay inside local preview boundaries with useful download actions.",
    "api.eyebrow": "API docs",
    "api.title": "Start from createViewer",
    "api.desc": "The API stays focused: container, file, plugins, size, theme and lifecycle callbacks. Complex formats are extended through plugins.",
    "api.nav.options": "PreviewOptions",
    "api.nav.instance": "FileViewer",
    "api.nav.plugin": "Plugin Protocol",
    "api.pluginTitle": "Custom plugin protocol",
    "api.pluginDesc": "A plugin implements match and render. render receives PreviewContext and returns a destroyable PreviewInstance.",
    "frameworks.eyebrow": "Framework integration",
    "frameworks.title": "One core for vanilla JS, React and Vue",
    "frameworks.desc": "Pick the entry point for your stack. The underlying plugin capability stays consistent across products.",
    "formats.eyebrow": "Format matrix",
    "formats.title": "Common attachments, documents and engineering files",
    "formats.desc": "Formats live at different capability levels: native preview, parsed view, structure view, placeholder recognition or download fallback.",
    "cases.eyebrow": "Use cases",
    "cases.title": "Embedded in real product flows",
    "cases.desc": "Preview is not a separate page. It belongs in lists, approvals, support consoles, cloud drives, knowledge bases and engineering hubs.",
    "cases.card1.title": "Knowledge base and drive",
    "cases.card1.desc": "Preview files inside lists, detail pages and search results to reduce downloads and context switching.",
    "cases.card2.title": "Approval and contracts",
    "cases.card2.desc": "Read PDF, Word, Excel, OFD and email attachments in one consistent container for enterprise workflows.",
    "cases.card3.title": "Engineering file hub",
    "cases.card3.desc": "CAD, 3D, GIS and archive previews help teams understand technical files before downloading.",
    "cases.card4.title": "SaaS attachment center",
    "cases.card4.desc": "Reuse a consistent preview experience across CRM, ticketing and project management products.",
    "playground.eyebrow": "Online playground",
    "playground.title": "Drop files and preview them instantly",
    "playground.desc": "Local files stay in your browser and are not uploaded. Built-in samples cover Markdown, JSON, SVG and DXF.",
    "playground.dropTitle": "Choose or drop files",
    "playground.dropDesc": "Multi-file preview queue supported",
    "playground.sample": "Built-in sample",
    "playground.width": "Width",
    "playground.height": "Height",
    "playground.fit": "Fit",
    "playground.viewerTheme": "Viewer theme",
    "playground.apply": "Apply settings",
    "playground.current": "Current file",
    "footer.text": "Container-first file preview SDK for modern web products."
  }
};

const apiOptions: ApiRow[] = [
  { name: "container", type: "HTMLElement | string", description: { zh: "必填。预览挂载容器。", en: "Required. The container where the preview is mounted." } },
  { name: "file", type: "PreviewSource", description: { zh: "单文件预览源，支持 File、Blob、URL、ArrayBuffer。", en: "Single preview source: File, Blob, URL or ArrayBuffer." } },
  { name: "files", type: "(PreviewSource | PreviewItem)[]", description: { zh: "多文件预览队列，可配合工具栏切换。", en: "Multi-file queue, usable with toolbar navigation." } },
  { name: "fileName", type: "string", description: { zh: "辅助扩展名识别和下载命名。", en: "Helps extension detection and download naming." } },
  { name: "mimeType", type: "string", description: { zh: "辅助 MIME 类型识别。", en: "Helps MIME type detection." } },
  { name: "width / height", type: "number | string", description: { zh: "容器尺寸，支持 CSS 尺寸值。", en: "Container size, including CSS size values." } },
  { name: "fit", type: "PreviewFit", description: { zh: "内容适配策略：contain、cover、width、height、actual、scale-down。", en: "Content fit mode: contain, cover, width, height, actual or scale-down." } },
  { name: "plugins", type: "PreviewPlugin[]", description: { zh: "内置插件或自定义插件列表。", en: "Built-in or custom plugin list." } },
  { name: "toolbar", type: "boolean | PreviewToolbarOptions", description: { zh: "下载、全屏、打印、搜索、缩放、旋转等工具栏能力。", en: "Toolbar controls for download, fullscreen, print, search, zoom and rotate." } },
  { name: "theme", type: "light | dark | auto", description: { zh: "预览器主题。", en: "Viewer theme." } },
  { name: "onLoad / onError", type: "callback", description: { zh: "加载完成和错误回调。", en: "Lifecycle callbacks for load and error states." } }
];

const instanceApi: ApiRow[] = [
  { name: "reload(file?)", type: "Promise<void>", description: { zh: "重新加载当前文件，或替换当前文件。", en: "Reload the current file, or replace it with a new source." } },
  { name: "next()", type: "Promise<void>", description: { zh: "跳转到队列中的下一个文件。", en: "Move to the next file in the queue." } },
  { name: "previous()", type: "Promise<void>", description: { zh: "跳转到队列中的上一个文件。", en: "Move to the previous file in the queue." } },
  { name: "goTo(index)", type: "Promise<void>", description: { zh: "跳转到指定队列索引。", en: "Move to a specific queue index." } },
  { name: "resize()", type: "void", description: { zh: "手动触发尺寸重算。", en: "Manually trigger size recalculation." } },
  { name: "destroy()", type: "void", description: { zh: "销毁预览实例并清理资源。", en: "Destroy the preview instance and release resources." } }
];

const formats = [
  { title: "Image", level: { zh: "原生/增强", en: "Native / enhanced" }, items: "jpg png gif webp avif svg bmp tif heic" },
  { title: "Office", level: { zh: "基础/版式解析", en: "Parsed / layout" }, items: "docx xlsx pptx odt ods odp rtf csv tsv" },
  { title: "PDF / OFD / EPUB / XPS", level: { zh: "PDF 高保真，OFD/EPUB/XPS 基础", en: "PDF rich, OFD/EPUB/XPS basic" }, items: "pdf ofd epub xps" },
  { title: "Media", level: { zh: "浏览器播放 + fallback", en: "Browser playback + fallback" }, items: "mp4 webm m3u8 mp3 wav flac opus" },
  { title: "Archive", level: { zh: "目录和内嵌预览", en: "Structure and nested preview" }, items: "zip rar 7z tar gz tgz bz2 xz" },
  { title: "Email", level: { zh: "正文、附件、内嵌图片", en: "Body, attachments, inline images" }, items: "eml msg mbox" },
  { title: "Drawing / CAD", level: { zh: "基础图形和结构", en: "Basic shapes and structure" }, items: "drawio excalidraw dxf dwg step iges" },
  { title: "3D / GIS", level: { zh: "模型/地图数据", en: "Models / map data" }, items: "gltf glb obj stl fbx dae geojson kml kmz gpx shp" }
];

const frameworkCopy: Record<CodeTab, Record<Language, string>> = {
  vanilla: {
    zh: "适合任意 Web 项目、后台系统、低代码平台或不使用框架的页面。直接传入 DOM 容器即可。",
    en: "Ideal for any web product, admin console, low-code surface or framework-free page. Pass a DOM container and render."
  },
  react: {
    zh: "适合附件卡片、详情页、审批弹窗等组件化场景。React 适配层负责实例生命周期。",
    en: "Great for attachment cards, detail pages and approval modals. The React adapter owns the viewer lifecycle."
  },
  vue: {
    zh: "适合 Vue 业务系统和组合式项目。通过 props 传递文件、尺寸、插件和主题。",
    en: "Designed for Vue business apps and composition-friendly projects. Pass file, size, plugins and theme through props."
  }
};

const codeSamples: Record<CodeTab, string> = {
  vanilla: `import {
  createViewer,
  imagePlugin,
  pdfPlugin,
  epubPlugin,
  xpsPlugin,
  officePlugin,
  textPlugin
} from "@open-file-viewer/core";
import "@open-file-viewer/core/style.css";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";

const viewer = createViewer({
  container: "#viewer",
  file,
  fileName: file.name,
  height: "70vh",
  fit: "contain",
  toolbar: true,
  theme: "auto",
  plugins: [
    imagePlugin(),
    pdfPlugin({ workerSrc: pdfWorkerSrc }),
    epubPlugin(),
    xpsPlugin(),
    officePlugin(),
    textPlugin()
  ]
});`,
  react: `import { FileViewer } from "@open-file-viewer/react";
import {
  imagePlugin,
  pdfPlugin,
  epubPlugin,
  xpsPlugin,
  officePlugin
} from "@open-file-viewer/core";

const plugins = [
  imagePlugin(),
  pdfPlugin({ workerSrc }),
  epubPlugin(),
  xpsPlugin(),
  officePlugin()
];

export function AttachmentPreview({ file }) {
  return (
    <FileViewer
      file={file}
      fileName={file.name}
      height="640px"
      toolbar
      theme="auto"
      plugins={plugins}
    />
  );
}`,
  vue: `<script setup lang="ts">
import { OpenFileViewer } from "@open-file-viewer/vue";
import { epubPlugin, imagePlugin, pdfPlugin, xpsPlugin } from "@open-file-viewer/core";

defineProps<{ file: File }>();
const plugins = [imagePlugin(), pdfPlugin({ workerSrc }), epubPlugin(), xpsPlugin()];
</script>

<template>
  <OpenFileViewer
    :file="file"
    :file-name="file.name"
    height="640px"
    theme="auto"
    :plugins="plugins"
  />
</template>`
};

const pluginCode = `import type { PreviewPlugin } from "@open-file-viewer/core";

export function customPlugin(): PreviewPlugin {
  return {
    name: "custom",
    match(file) {
      return file.extension === "custom";
    },
    render(ctx) {
      const element = document.createElement("div");
      element.textContent = ctx.file.name;
      ctx.viewport.append(element);

      return {
        resize(size) {
          console.log("container resized", size);
        },
        destroy() {
          element.remove();
        }
      };
    }
  };
}`;

const demoFiles: DemoFile[] = [
  {
    label: { zh: "欢迎 Markdown", en: "Welcome Markdown" },
    file: new File(
      [
        `# Open File Viewer

这是一个嵌入式文件预览器官网示例。

- 支持多种文件插件
- 支持黑暗模式和双语官网
- 支持本地文件在线预览

\`\`\`ts
createViewer({ container: "#viewer", file, plugins });
\`\`\`
`
      ],
      "welcome.md",
      { type: "text/markdown" }
    )
  },
  {
    label: { zh: "API JSON", en: "API JSON" },
    file: new File([JSON.stringify({ package: "@open-file-viewer/core", api: "createViewer", frameworks: ["vanilla", "react", "vue"] }, null, 2)], "api.json", {
      type: "application/json"
    })
  },
  {
    label: { zh: "矢量 SVG", en: "Vector SVG" },
    file: new File(
      [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 520">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#19d3ff"/>
      <stop offset="0.55" stop-color="#7c5cff"/>
      <stop offset="1" stop-color="#36f3a5"/>
    </linearGradient>
  </defs>
  <rect width="900" height="520" rx="34" fill="#07111f"/>
  <path d="M170 360 C260 140 430 430 540 180 S730 240 760 120" fill="none" stroke="url(#g)" stroke-width="28" stroke-linecap="round"/>
  <circle cx="230" cy="180" r="54" fill="#19d3ff" opacity=".9"/>
  <rect x="520" y="300" width="190" height="90" rx="22" fill="#36f3a5" opacity=".88"/>
  <text x="80" y="90" fill="#fff" font-size="44" font-family="Arial">Open File Viewer</text>
</svg>`
      ],
      "brand-preview.svg",
      { type: "image/svg+xml" }
    )
  },
  {
    label: { zh: "DXF 图纸", en: "DXF Drawing" },
    file: new File(
      [
        `0
SECTION
2
ENTITIES
0
LINE
8
0
10
0
20
0
11
120
21
80
0
CIRCLE
8
0
10
180
20
120
40
48
0
ENDSEC
0
EOF`
      ],
      "drawing.dxf",
      { type: "application/dxf" }
    )
  }
];

const container = requiredElement<HTMLElement>("#viewer");
const fileInput = requiredElement<HTMLInputElement>("#file");
const sampleInput = requiredElement<HTMLSelectElement>("#sample");
const widthInput = requiredElement<HTMLInputElement>("#width");
const heightInput = requiredElement<HTMLInputElement>("#height");
const fitInput = requiredElement<HTMLSelectElement>("#fit");
const themeInput = requiredElement<HTMLSelectElement>("#theme");
const applyButton = requiredElement<HTMLButtonElement>("#apply");
const currentFileLabel = requiredElement<HTMLElement>("#currentFile");
const languageToggle = requiredElement<HTMLButtonElement>("#languageToggle");
const themeToggle = requiredElement<HTMLButtonElement>("#themeToggle");
const codeSample = requiredElement<HTMLElement>("#codeSample");
const pluginCodeElement = requiredElement<HTMLElement>("#pluginCode");
const formatGrid = requiredElement<HTMLElement>("#formatGrid");
const apiOptionsElement = requiredElement<HTMLElement>("#apiOptions");
const instanceApiElement = requiredElement<HTMLElement>("#instanceApi");
const frameworkCopyElement = requiredElement<HTMLElement>("#frameworkCopy");

let viewer: FileViewer | null = null;
let viewerInitialized = false;
let currentFiles: Array<File | Blob> = [demoFiles[0].file];
let language: Language = readStorage("ofv-language") === "en" ? "en" : "zh";
let siteTheme: SiteTheme = readStorage("ofv-site-theme") === "light" ? "light" : "dark";
let activeCodeTab: CodeTab = "vanilla";

function createPlugins() {
  return [
    imagePlugin(),
    videoPlugin(),
    audioPlugin(),
    pdfPlugin({ workerSrc: pdfWorkerSrc }),
    epubPlugin(),
    xpsPlugin(),
    officePlugin(),
    ofdPlugin(),
    archivePlugin(),
    emailPlugin(),
    drawingPlugin(),
    cadPlugin(),
    model3dPlugin(),
    gisPlugin(),
    textPlugin()
  ];
}

function renderViewer() {
  viewerInitialized = true;
  const firstFile = currentFiles[0];
  viewer?.destroy();
  viewer = createViewer({
    container,
    file: firstFile,
    files: currentFiles,
    fileName: firstFile instanceof File ? firstFile.name : "preview.bin",
    width: widthInput.value,
    height: heightInput.value,
    fit: fitInput.value as PreviewFit,
    theme: themeInput.value as PreviewTheme,
    toolbar: true,
    plugins: createPlugins(),
    onLoad(file) {
      currentFileLabel.textContent = file.name;
    },
    onError(error) {
      console.error(error);
    }
  });
}

function routeFromHash(): Route {
  const hash = window.location.hash.replace(/^#/, "") || "/";
  return routes.includes(hash as Route) ? (hash as Route) : "/";
}

function applyRoute(route = routeFromHash()) {
  for (const view of document.querySelectorAll<HTMLElement>("[data-view]")) {
    view.classList.toggle("active", view.dataset.view === route);
  }
  for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-route]")) {
    link.classList.toggle("active", link.dataset.route === route);
  }
  document.body.dataset.route = route;
  requestAnimationFrame(() => {
    for (const element of document.querySelectorAll<HTMLElement>(".view.active .reveal")) {
      element.classList.add("is-visible");
    }
  });
  if (route === "/playground") {
    if (!viewerInitialized) {
      renderViewer();
      return;
    }
    setTimeout(() => viewer?.resize(), 80);
  }
}

function applyLanguage(nextLanguage: Language) {
  language = nextLanguage;
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  for (const element of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
    const key = element.dataset.i18n;
    if (key && translations[language][key]) {
      element.textContent = translations[language][key];
    }
  }
  languageToggle.textContent = language === "zh" ? "EN" : "中文";
  writeStorage("ofv-language", language);
  populateSamples();
  populateApiTables();
  populateFormats();
  setCodeSample(activeCodeTab);
}

function applySiteTheme(nextTheme: SiteTheme) {
  siteTheme = nextTheme;
  document.documentElement.dataset.siteTheme = siteTheme;
  themeToggle.textContent = siteTheme === "dark" ? "☀" : "●";
  themeToggle.setAttribute("aria-label", siteTheme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  writeStorage("ofv-site-theme", siteTheme);
}

function requiredElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required docs element: ${selector}`);
  }
  return element;
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Preferences are optional; the docs site still works without persistent storage.
  }
}

function populateApiTables() {
  apiOptionsElement.replaceChildren(...apiOptions.map(createApiRow));
  instanceApiElement.replaceChildren(...instanceApi.map(createApiRow));
}

function createApiRow(row: ApiRow): HTMLElement {
  const item = document.createElement("div");
  item.className = "api-row";
  const name = document.createElement("strong");
  name.textContent = row.name;
  const type = document.createElement("code");
  type.textContent = row.type;
  const desc = document.createElement("span");
  desc.textContent = row.description[language];
  item.append(name, type, desc);
  return item;
}

function populateFormats() {
  formatGrid.replaceChildren(
    ...formats.map((format) => {
      const card = document.createElement("article");
      const title = document.createElement("h3");
      title.textContent = format.title;
      const level = document.createElement("p");
      level.textContent = format.level[language];
      const tags = document.createElement("div");
      tags.className = "tag-list";
      for (const item of format.items.split(" ")) {
        const tag = document.createElement("span");
        tag.textContent = item;
        tags.append(tag);
      }
      card.append(title, level, tags);
      return card;
    })
  );
}

function populateSamples() {
  const selected = sampleInput.value || "0";
  sampleInput.replaceChildren(
    ...demoFiles.map((demo, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = demo.label[language];
      return option;
    })
  );
  sampleInput.value = selected;
}

function setCodeSample(key: CodeTab) {
  activeCodeTab = key;
  codeSample.textContent = codeSamples[key];
  frameworkCopyElement.textContent = frameworkCopy[key][language];
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-code-tab]")) {
    button.classList.toggle("active", button.dataset.codeTab === key);
  }
}

function setupRevealObserver() {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        }
      }
    },
    { threshold: 0.16 }
  );
  for (const element of document.querySelectorAll(".reveal")) {
    observer.observe(element);
  }
}

fileInput.addEventListener("change", () => {
  const files = Array.from(fileInput.files || []);
  if (!files.length) {
    return;
  }
  currentFiles = files;
  renderViewer();
});

sampleInput.addEventListener("change", () => {
  const demo = demoFiles[Number(sampleInput.value)] || demoFiles[0];
  currentFiles = [demo.file];
  renderViewer();
});

applyButton.addEventListener("click", renderViewer);
themeInput.addEventListener("change", renderViewer);

languageToggle.addEventListener("click", () => {
  applyLanguage(language === "zh" ? "en" : "zh");
});

themeToggle.addEventListener("click", () => {
  applySiteTheme(siteTheme === "dark" ? "light" : "dark");
});

window.addEventListener("hashchange", () => applyRoute());

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-code-tab]")) {
  button.addEventListener("click", () => {
    setCodeSample((button.dataset.codeTab || "vanilla") as CodeTab);
  });
}

pluginCodeElement.textContent = pluginCode;
applySiteTheme(siteTheme);
applyLanguage(language);
setCodeSample("vanilla");
setupRevealObserver();
applyRoute();
