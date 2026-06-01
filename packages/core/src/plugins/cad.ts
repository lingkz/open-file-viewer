import type { PreviewPlugin } from "../types";
import { createPanel, createSection, escapeHtml, readTextFile } from "./utils";

const cadExtensions = new Set(["dxf", "dwg", "dwf", "step", "stp", "iges", "igs"]);

export function cadPlugin(): PreviewPlugin {
  return {
    name: "cad",
    match(file) {
      return cadExtensions.has(file.extension);
    },
    async render(ctx) {
      const panel = createPanel("ofv-cad");
      ctx.viewport.append(panel);

      if (ctx.file.extension !== "dxf") {
        const section = createSection("CAD 基础预览");
        section.append(`.${ctx.file.extension} 已识别为图纸/工程格式，当前前端插件优先渲染 DXF。该格式建议接入服务端转换或 WASM 专用引擎。`);
        panel.append(section);
        return { destroy: () => panel.remove() };
      }

      const dxf = await readTextFile(ctx.file);
      renderDxf(panel, dxf);
      return {
        destroy() {
          panel.remove();
        }
      };
    }
  };
}

function renderDxf(panel: HTMLElement, dxf: string): void {
  const pairs = dxf.split(/\r?\n/).map((line) => line.trim());
  const lines: Array<[number, number, number, number]> = [];
  const circles: Array<[number, number, number]> = [];

  for (let index = 0; index < pairs.length; index += 2) {
    const code = pairs[index];
    const value = pairs[index + 1];
    if (code === "0" && value === "LINE") {
      const entity = readEntity(pairs, index + 2);
      lines.push([
        Number(entity["10"] || 0),
        Number(entity["20"] || 0),
        Number(entity["11"] || 0),
        Number(entity["21"] || 0)
      ]);
    }
    if (code === "0" && value === "CIRCLE") {
      const entity = readEntity(pairs, index + 2);
      circles.push([
        Number(entity["10"] || 0),
        Number(entity["20"] || 0),
        Number(entity["40"] || 0)
      ]);
    }
  }

  const section = createSection(`DXF 基础预览`);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "ofv-svg-stage");

  const bounds = computeBounds(lines, circles);
  svg.setAttribute("viewBox", `${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`);

  for (const [x1, y1, x2, y2] of lines.slice(0, 3000)) {
    const line = document.createElementNS(svg.namespaceURI, "line");
    line.setAttribute("x1", String(x1));
    line.setAttribute("y1", String(-y1));
    line.setAttribute("x2", String(x2));
    line.setAttribute("y2", String(-y2));
    line.setAttribute("stroke", "#111827");
    line.setAttribute("stroke-width", String(bounds.stroke));
    svg.append(line);
  }

  for (const [cx, cy, radius] of circles.slice(0, 1000)) {
    const circle = document.createElementNS(svg.namespaceURI, "circle");
    circle.setAttribute("cx", String(cx));
    circle.setAttribute("cy", String(-cy));
    circle.setAttribute("r", String(Math.abs(radius)));
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", "#2563eb");
    circle.setAttribute("stroke-width", String(bounds.stroke));
    svg.append(circle);
  }

  const note = document.createElement("p");
  note.innerHTML = escapeHtml(`已提取 LINE ${lines.length} 个、CIRCLE ${circles.length} 个。复杂图元会在后续增强。`);
  section.append(note, svg);
  panel.append(section);
}

function readEntity(pairs: string[], start: number): Record<string, string> {
  const entity: Record<string, string> = {};
  for (let index = start; index < pairs.length; index += 2) {
    const code = pairs[index];
    const value = pairs[index + 1];
    if (code === "0") {
      break;
    }
    entity[code] = value;
  }
  return entity;
}

function computeBounds(
  lines: Array<[number, number, number, number]>,
  circles: Array<[number, number, number]>
): { minX: number; minY: number; width: number; height: number; stroke: number } {
  const xs = lines.flatMap(([x1, , x2]) => [x1, x2]);
  const ys = lines.flatMap(([, y1, , y2]) => [-y1, -y2]);
  for (const [cx, cy, radius] of circles) {
    xs.push(cx - radius, cx + radius);
    ys.push(-cy - radius, -cy + radius);
  }
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 100);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 100);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  return {
    minX,
    minY,
    width,
    height,
    stroke: Math.max(width, height) / 600
  };
}
