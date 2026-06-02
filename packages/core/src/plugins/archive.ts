import JSZip from "jszip";
import pako from "pako";
import type { PreviewPlugin, PreviewFile } from "../types";
import { fallbackPlugin } from "./fallback";
import { createObjectUrl, revokeObjectUrl } from "../dom";
import { appendMeta, createPanel, createSection, readArrayBuffer } from "./utils";

const archiveExtensions = new Set(["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz"]);

interface ArchiveEntry {
  name: string;
  size: number;
  dir: boolean;
  read: () => Promise<ArrayBuffer>;
}

export function archivePlugin(): PreviewPlugin {
  return {
    name: "archive",
    match(file) {
      return archiveExtensions.has(file.extension);
    },
    async render(ctx) {
      const url = createObjectUrl(ctx.file);
      const isExternal = Boolean(ctx.file.url);
      const panel = createPanel("ofv-archive");
      ctx.viewport.append(panel);

      const ext = ctx.file.extension.toLowerCase();
      let archiveEntries: ArchiveEntry[] = [];
      let isEncrypted = false;
      let parseError: string | null = null;

      // 1. Parse different archive formats
      try {
        if (ext === "zip") {
          try {
            const zip = await JSZip.loadAsync(await readArrayBuffer(ctx.file));
            archiveEntries = Object.values(zip.files).map((entry) => ({
              name: entry.name,
              size: (entry as any)._data?.uncompressedSize || 0,
              dir: entry.dir,
              read: () => entry.async("arraybuffer")
            }));
          } catch (zipErr: any) {
            // Check for encryption errors
            if (
              zipErr.message &&
              (zipErr.message.includes("encrypted") ||
                zipErr.message.includes("password") ||
                zipErr.message.includes("protected"))
            ) {
              isEncrypted = true;
            } else {
              throw zipErr;
            }
          }
        } else if (ext === "tar") {
          archiveEntries = untar(await readArrayBuffer(ctx.file));
        } else if (ext === "gz" || ext === "tgz" || ext === "tar.gz") {
          const u8 = new Uint8Array(await readArrayBuffer(ctx.file));
          const decompressed = pako.ungzip(u8);
          const originalName = ctx.file.name.endsWith(".gz")
            ? ctx.file.name.slice(0, -3)
            : ctx.file.name.endsWith(".tgz")
            ? ctx.file.name.slice(0, -4) + ".tar"
            : ctx.file.name;

          if (ext === "tgz" || ext === "tar.gz" || originalName.endsWith(".tar")) {
            archiveEntries = untar(decompressed.buffer);
          } else {
            // Single decompressed file
            archiveEntries = [
              {
                name: originalName,
                size: decompressed.byteLength,
                dir: false,
                read: async () => decompressed.buffer
              }
            ];
          }
        } else {
          // rar, 7z, bz2, xz: show friendly native fallback message
          parseError = `该格式 (.${ext.toUpperCase()}) 目前暂不支持直接在浏览器端在线解压和目录预览。`;
        }
      } catch (err: any) {
        parseError = `压缩包解析失败：${err.message || err}`;
      }

      // 2. Encrypted Archive Prompt UI
      if (isEncrypted) {
        const fallback = document.createElement("div");
        fallback.className = "ofv-fallback";
        
        const title = document.createElement("strong");
        title.innerHTML = "🔒 该压缩包已被加密保护";
        
        const meta = document.createElement("span");
        meta.textContent = "为了您的数据安全，本预览器不支持直接在线解密。请下载文件后在本地输入密码解压。";
        
        const download = document.createElement("a");
        download.href = url;
        download.download = ctx.file.name;
        download.textContent = "下载文件";
        
        fallback.append(title, meta, download);
        panel.append(fallback);
        ctx.viewport.classList.add("ofv-center");
        
        return {
          destroy() {
            ctx.viewport.classList.remove("ofv-center");
            revokeObjectUrl(url, isExternal);
            panel.remove();
          }
        };
      }

      // 3. Fallback Unsupported message (RAR, 7z, etc.)
      if (parseError) {
        const fallback = document.createElement("div");
        fallback.className = "ofv-fallback";
        
        const title = document.createElement("strong");
        title.textContent = parseError;
        
        const meta = document.createElement("span");
        meta.textContent = "建议下载视频/文档等文件至本地查看，或使用原生解压工具提取内容。";
        
        const download = document.createElement("a");
        download.href = url;
        download.download = ctx.file.name;
        download.textContent = "下载压缩包";
        
        fallback.append(title, meta, download);
        panel.append(fallback);
        ctx.viewport.classList.add("ofv-center");

        return {
          destroy() {
            ctx.viewport.classList.remove("ofv-center");
            revokeObjectUrl(url, isExternal);
            panel.remove();
          }
        };
      }

      // 4. Split Layout UI for interactive preview
      const layout = document.createElement("div");
      layout.className = "ofv-archive-layout";

      const sidebar = document.createElement("div");
      sidebar.className = "ofv-archive-sidebar";

      const header = document.createElement("div");
      header.className = "ofv-archive-header";
      header.textContent = `文件列表 (${archiveEntries.filter(e => !e.dir).length})`;
      sidebar.append(header);

      const tree = document.createElement("div");
      tree.className = "ofv-archive-tree";
      sidebar.append(tree);

      const mainPanel = document.createElement("div");
      mainPanel.className = "ofv-archive-main";

      layout.append(sidebar, mainPanel);
      panel.append(layout);

      let currentSubInstance: any = null;

      // Render default metadata summary
      const showDefaultSummary = () => {
        mainPanel.innerHTML = "";
        const summary = document.createElement("div");
        summary.className = "ofv-archive-info";
        
        const heading = document.createElement("h3");
        heading.textContent = ctx.file.name;

        const info = document.createElement("div");
        info.className = "ofv-archive-info-meta";
        
        const fileCount = archiveEntries.filter(e => !e.dir).length;
        const dirCount = archiveEntries.filter(e => e.dir).length;
        
        info.innerHTML = `
          <div><strong>格式类型：</strong>.${ext.toUpperCase()} 压缩文件</div>
          <div><strong>包含文件数：</strong>${fileCount} 个</div>
          <div><strong>包含目录数：</strong>${dirCount} 个</div>
          <div><strong>操作提示：</strong>请点击左侧栏中的文件进行联动预览。</div>
        `;
        
        summary.append(heading, info);
        mainPanel.append(summary);
      };

      showDefaultSummary();

      // Filter and render items (max 500 to keep DOM lightweight)
      const visibleEntries = archiveEntries.filter(e => !e.dir).slice(0, 500);

      visibleEntries.forEach((entry) => {
        const item = document.createElement("div");
        item.className = "ofv-archive-item";

        const icon = document.createElement("span");
        icon.className = "ofv-archive-item-icon";
        icon.textContent = getIcon(entry.name, entry.dir);

        const name = document.createElement("span");
        name.className = "ofv-archive-item-name";
        name.textContent = entry.name;
        name.title = entry.name;

        item.append(icon, name);
        tree.append(item);

        item.addEventListener("click", async () => {
          // Highlight active item
          sidebar.querySelectorAll(".ofv-archive-item").forEach((el) => el.classList.remove("is-active"));
          item.classList.add("is-active");

          // Cleanup previous sub-preview
          if (currentSubInstance) {
            currentSubInstance.destroy();
            currentSubInstance = null;
          }

          // Show loading state
          mainPanel.innerHTML = `
            <div class="ofv-archive-loading">
              <div class="ofv-archive-loading-spinner"></div>
              <span>正在解压并加载 [${entry.name.split("/").pop()}]...</span>
            </div>
          `;

          try {
            let buffer = await entry.read();
            const subName = entry.name.split("/").pop() || entry.name;
            const subExt = subName.split(".").pop()?.toLowerCase() || "";
            const subMime = getMimeType(subName);

            // Shapefile components linkage mechanism:
            // Combine adjacent .dbf, .shx, and .prj files into a single ZIP buffer in memory
            if (subExt === "shp") {
              const basePath = entry.name.slice(0, -4);
              const dbfEntry = archiveEntries.find(
                (e) => e.name.toLowerCase() === basePath.toLowerCase() + ".dbf"
              );
              const shxEntry = archiveEntries.find(
                (e) => e.name.toLowerCase() === basePath.toLowerCase() + ".shx"
              );
              if (dbfEntry && shxEntry) {
                const prjEntry = archiveEntries.find(
                  (e) => e.name.toLowerCase() === basePath.toLowerCase() + ".prj"
                );
                const newZip = new JSZip();
                newZip.file(subName, buffer);
                newZip.file(dbfEntry.name.split("/").pop()!, await dbfEntry.read());
                newZip.file(shxEntry.name.split("/").pop()!, await shxEntry.read());
                if (prjEntry) {
                  newZip.file(prjEntry.name.split("/").pop()!, await prjEntry.read());
                }
                buffer = await newZip.generateAsync({ type: "arraybuffer" });
              }
            }

            const subContainer = document.createElement("div");
            subContainer.style.cssText = "width: 100%; height: 100%; position: relative; display: flex; flex-direction: column;";
            mainPanel.replaceChildren(subContainer);

            const subViewport = document.createElement("div");
            subViewport.className = "ofv-viewport";
            subViewport.style.cssText = "flex: 1; width: 100%; height: 100%; position: relative; overflow: auto;";
            subContainer.append(subViewport);

            const subFile: PreviewFile = {
              source: buffer,
              name: subName,
              extension: subExt,
              mimeType: subMime
            };

            const plugins = [...(ctx.options.plugins || []), fallbackPlugin()];
            let matchedPlugin = plugins.find((p) => p.match(subFile)) || fallbackPlugin();
            if (matchedPlugin.name === "archive") {
              matchedPlugin = fallbackPlugin();
            }

            currentSubInstance = await matchedPlugin.render({
              host: ctx.host,
              viewport: subViewport,
              file: subFile,
              size: { width: subViewport.clientWidth || 600, height: subViewport.clientHeight || 400 },
              options: ctx.options,
              setLoading: () => {},
              setError: (err) => {
                subViewport.innerHTML = `<div class="ofv-fallback"><strong>文件预览失败</strong><span>${err}</span></div>`;
              }
            });
          } catch (err: any) {
            mainPanel.innerHTML = `<div class="ofv-fallback"><strong>解压加载失败</strong><span>${err.message || err}</span></div>`;
          }
        });
      });

      return {
        destroy() {
          if (currentSubInstance) {
            currentSubInstance.destroy();
          }
          revokeObjectUrl(url, isExternal);
          panel.remove();
        }
      };
    }
  };
}

// 5. Lightweight TAR parser
function untar(arrayBuffer: ArrayBuffer): ArchiveEntry[] {
  const entries: ArchiveEntry[] = [];
  const u8 = new Uint8Array(arrayBuffer);
  let offset = 0;

  const readString = (start: number, length: number): string => {
    let end = start;
    while (end < start + length && u8[end] !== 0) {
      end++;
    }
    return new TextDecoder().decode(u8.subarray(start, end)).trim();
  };

  while (offset + 512 <= arrayBuffer.byteLength) {
    const magic = readString(offset + 257, 6);
    if (magic !== "ustar" && magic !== "ustar\0") {
      let allZero = true;
      for (let i = 0; i < 512; i++) {
        if (u8[offset + i] !== 0) {
          allZero = false;
          break;
        }
      }
      if (allZero) {
        break; // End of archive
      }
      break;
    }

    const name = readString(offset, 100);
    const prefix = readString(offset + 345, 155);
    const fullName = prefix ? `${prefix}/${name}` : name;

    const sizeStr = readString(offset + 124, 12);
    const size = parseInt(sizeStr, 8) || 0;
    const typeflag = readString(offset + 156, 1);
    const dir = typeflag === "5" || fullName.endsWith("/");

    const contentOffset = offset + 512;
    entries.push({
      name: fullName,
      size,
      dir,
      read: async () => arrayBuffer.slice(contentOffset, contentOffset + size)
    });

    offset += 512 + Math.ceil(size / 512) * 512;
  }

  return entries;
}

// 6. UI Helpers
function getIcon(name: string, dir: boolean): string {
  if (dir) return "📁";
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
      return "🖼️";
    case "pdf":
      return "📕";
    case "doc":
    case "docx":
      return "📘";
    case "xls":
    case "xlsx":
      return "📗";
    case "ppt":
    case "pptx":
      return "📙";
    case "zip":
    case "rar":
    case "7z":
    case "tar":
    case "gz":
      return "📦";
    case "mp4":
    case "mkv":
    case "avi":
    case "webm":
      return "🎥";
    case "mp3":
    case "wav":
    case "ogg":
      return "🎵";
    case "txt":
    case "md":
    case "html":
    case "js":
    case "ts":
    case "json":
    case "css":
      return "📄";
    default:
      return "📄";
  }
}

function getMimeType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "gif": return "image/gif";
    case "svg": return "image/svg+xml";
    case "webp": return "image/webp";
    case "pdf": return "application/pdf";
    case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "pptx": return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "txt": return "text/plain";
    case "md": return "text/markdown";
    case "html": return "text/html";
    case "js": return "application/javascript";
    case "ts": return "application/typescript";
    case "json": return "application/json";
    case "css": return "text/css";
    case "mp4": return "video/mp4";
    case "webm": return "video/webm";
    case "mp3": return "audio/mpeg";
    case "wav": return "audio/wav";
    default: return "application/octet-stream";
  }
}
