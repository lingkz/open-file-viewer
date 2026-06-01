import pako from "pako";
import type { PreviewPlugin } from "../types";
import { createPanel, createSection, escapeHtml, readTextFile } from "./utils";

const drawingExtensions = new Set(["drawio", "dio", "excalidraw", "tldraw"]);

export function drawingPlugin(): PreviewPlugin {
  return {
    name: "drawing",
    match(file) {
      return drawingExtensions.has(file.extension);
    },
    async render(ctx) {
      const panel = createPanel("ofv-drawing");
      ctx.viewport.append(panel);
      const text = await readTextFile(ctx.file);

      if (ctx.file.extension === "excalidraw") {
        renderExcalidraw(panel, text);
      } else if (ctx.file.extension === "drawio" || ctx.file.extension === "dio") {
        renderDrawio(panel, text);
      } else {
        renderRawDrawing(panel, ctx.file.extension, text);
      }

      return {
        destroy() {
          panel.remove();
        }
      };
    }
  };
}

function renderExcalidraw(panel: HTMLElement, text: string): void {
  const data = JSON.parse(text) as {
    elements?: Array<Record<string, unknown>>;
  };
  const elements = data.elements || [];
  const section = createSection(`Excalidraw ${elements.length} elements`);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "ofv-svg-stage");
  svg.setAttribute("viewBox", "0 0 1200 800");

  for (const element of elements) {
    const type = String(element.type || "");
    const x = Number(element.x || 0);
    const y = Number(element.y || 0);
    const width = Number(element.width || 80);
    const height = Number(element.height || 40);
    const stroke = String(element.strokeColor || "#111827");
    const fill = String(element.backgroundColor || "transparent");

    if (type === "rectangle" || type === "diamond") {
      const rect = document.createElementNS(svg.namespaceURI, "rect");
      rect.setAttribute("x", String(x));
      rect.setAttribute("y", String(y));
      rect.setAttribute("width", String(width));
      rect.setAttribute("height", String(height));
      rect.setAttribute("fill", fill);
      rect.setAttribute("stroke", stroke);
      svg.append(rect);
    } else if (type === "ellipse") {
      const ellipse = document.createElementNS(svg.namespaceURI, "ellipse");
      ellipse.setAttribute("cx", String(x + width / 2));
      ellipse.setAttribute("cy", String(y + height / 2));
      ellipse.setAttribute("rx", String(Math.abs(width / 2)));
      ellipse.setAttribute("ry", String(Math.abs(height / 2)));
      ellipse.setAttribute("fill", fill);
      ellipse.setAttribute("stroke", stroke);
      svg.append(ellipse);
    } else if (type === "line" || type === "arrow") {
      const line = document.createElementNS(svg.namespaceURI, "line");
      line.setAttribute("x1", String(x));
      line.setAttribute("y1", String(y));
      line.setAttribute("x2", String(x + width));
      line.setAttribute("y2", String(y + height));
      line.setAttribute("stroke", stroke);
      svg.append(line);
    } else if (type === "text") {
      const textNode = document.createElementNS(svg.namespaceURI, "text");
      textNode.setAttribute("x", String(x));
      textNode.setAttribute("y", String(y + 18));
      textNode.setAttribute("fill", stroke);
      textNode.textContent = String(element.text || "");
      svg.append(textNode);
    }
  }

  section.append(svg);
  panel.append(section);
}

function renderDrawio(panel: HTMLElement, text: string): void {
  const section = createSection("Draw.io 基础预览");
  const diagrams = [...text.matchAll(/<diagram[^>]*>([\s\S]*?)<\/diagram>/g)].map(
    (match) => match[1] || ""
  );
  const pre = document.createElement("pre");
  pre.className = "ofv-text-block";

  if (diagrams.length === 0) {
    pre.innerHTML = escapeHtml(text.slice(0, 20000));
  } else {
    pre.innerHTML = escapeHtml(
      diagrams
        .map((diagram, index) => `Diagram ${index + 1}\n${decodeDrawioDiagram(diagram)}`)
        .join("\n\n")
        .slice(0, 30000)
    );
  }
  section.append(pre);
  panel.append(section);
}

function renderRawDrawing(panel: HTMLElement, extension: string, text: string): void {
  const section = createSection(`${extension} 基础预览`);
  const pre = document.createElement("pre");
  pre.className = "ofv-text-block";
  pre.innerHTML = escapeHtml(text.slice(0, 30000));
  section.append(pre);
  panel.append(section);
}

function decodeDrawioDiagram(value: string): string {
  try {
    const decoded = decodeURIComponent(escape(atob(value)));
    return pako.inflateRaw(Uint8Array.from(decoded, (char) => char.charCodeAt(0)), {
      to: "string"
    }) as string;
  } catch {
    return value;
  }
}
