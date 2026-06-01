import { createViewer } from "@open-file-viewer/core";
import type { FileViewer, PreviewOptions, PreviewPlugin, PreviewSource } from "@open-file-viewer/core";
import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";

export const OpenFileViewer = defineComponent({
  name: "OpenFileViewer",
  props: {
    file: {
      type: [String, Blob, ArrayBuffer, File] as PropType<PreviewSource>,
      required: true
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
    }
  },
  setup(props) {
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
        fileName: props.fileName,
        mimeType: props.mimeType,
        width: props.width,
        height: props.height,
        fit: props.fit,
        plugins: props.plugins
      });
    };

    watch(
      () => [props.file, props.fileName, props.mimeType, props.width, props.height, props.fit],
      mount,
      { immediate: false }
    );

    onMounted(mount);

    onBeforeUnmount(() => {
      viewer?.destroy();
      viewer = null;
    });

    return () => h("div", { ref: containerRef });
  }
});

export type { FileViewer, PreviewOptions, PreviewPlugin, PreviewSource };
