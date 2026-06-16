<script lang="ts">
  import type { PreviewOptions } from "@open-file-viewer/core";
  import OpenFileViewer from "../src/OpenFileViewer.svelte";

  export let files: PreviewOptions["files"];
  export let plugins: PreviewOptions["plugins"];
</script>

<OpenFileViewer {files} {plugins}>
  <svelte:fragment slot="toolbar" let:ctx>
    {#if ctx}
      <button type="button" disabled={!ctx.canNext} on:click={() => void ctx.next()}>
        {ctx.index + 1}/{ctx.length} {ctx.file?.name}
      </button>
    {/if}
  </svelte:fragment>
</OpenFileViewer>
