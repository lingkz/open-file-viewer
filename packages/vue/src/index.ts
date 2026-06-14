import { createViewer } from "@open-file-viewer/core";
import type { FileViewer, PreviewOptions, PreviewPlugin, PreviewSource, PreviewTheme } from "@open-file-viewer/core";
import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";

export const OpenFileViewer = defineComponent({
  name: "OpenFileViewer",
  props: {
    file: {
      type: [String, Blob, ArrayBuffer, File] as PropType<PreviewSource>,
      required: false
    },
    files: {
      type: Array as PropType<PreviewOptions["files"]>,
      default: undefined
    },
    fileName: String,
    mimeType: String,
    width: {
      type: [String, Number],
      default: "100%"
    },
    height: {
      type: [String, Number],
      default: "600px"
    },
    fit: {
      type: String as () => PreviewOptions["fit"],
      default: "contain"
    },
    plugins: {
      type: Array as () => PreviewPlugin[],
      default: () => []
    },
    toolbar: {
      type: [Boolean, Object] as PropType<PreviewOptions["toolbar"]>,
      default: false
    },
    theme: {
      type: String as PropType<PreviewOptions["theme"]>,
      default: "light"
    },
    fallback: {
      type: String as PropType<PreviewOptions["fallback"]>,
      default: "inline"
    },
    renderFallback: Function as PropType<PreviewOptions["renderFallback"]>,
    className: String,
    onLoad: Function as PropType<PreviewOptions["onLoad"]>,
    onError: Function as PropType<PreviewOptions["onError"]>,
    onUnsupported: Function as PropType<PreviewOptions["onUnsupported"]>
  },
  emits: {
    load: (_file: unknown) => true,
    error: (_error: Error, _file?: unknown) => true,
    unsupported: (_file: unknown) => true
  },
  setup(props, { emit }) {
    const containerRef = ref<HTMLElement | null>(null);
    let viewer: FileViewer | null = null;

    const mount = () => {
      if (!containerRef.value) {
        return;
      }
      viewer?.destroy();
      viewer = createViewer({
        container: containerRef.value,
        file: props.file,
        files: props.files,
        fileName: props.fileName,
        mimeType: props.mimeType,
        width: props.width,
        height: props.height,
        fit: props.fit,
        plugins: props.plugins,
        toolbar: props.toolbar,
        theme: props.theme,
        fallback: props.fallback,
        renderFallback: props.renderFallback,
        className: props.className,
        onLoad(file) {
          props.onLoad?.(file);
          if (!props.onLoad) {
            emit("load", file);
          }
        },
        onError(error, file) {
          props.onError?.(error, file);
          if (!props.onError) {
            emit("error", error, file);
          }
        },
        onUnsupported(file) {
          props.onUnsupported?.(file);
          if (!props.onUnsupported) {
            emit("unsupported", file);
          }
        }
      });
    };

    watch(
      () => [
        props.file,
        props.files,
        props.fileName,
        props.mimeType,
        props.width,
        props.height,
        props.fit,
        props.plugins,
        props.fallback,
        props.renderFallback,
        props.toolbar,
        props.theme,
        props.className,
        props.onLoad,
        props.onError,
        props.onUnsupported
      ],
      mount,
      { immediate: false }
    );

    onMounted(mount);

    onBeforeUnmount(() => {
      viewer?.destroy();
      viewer = null;
    });

    return () => h("div", { ref: containerRef, class: props.className });
  }
});

export type { FileViewer, PreviewOptions, PreviewPlugin, PreviewSource, PreviewTheme };
