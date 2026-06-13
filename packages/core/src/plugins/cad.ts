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
      const viewer = renderDxf(panel, dxf);
      return {
        command(command) {
          return viewer.command(command);
        },
        destroy() {
          panel.remove();
        }
      };
    }
  };
}

function renderDxf(panel: HTMLElement, dxf: string): { command: (command: string) => boolean } {
  const pairs = dxf.split(/\r?\n/).map((line) => line.trim());
  const lines: Array<[number, number, number, number]> = [];
  const circles: Array<[number, number, number]> = [];
  const arcs: Array<[number, number, number, number, number]> = [];
  const points: Array<[number, number]> = [];
  const polylines: Array<Array<[number, number]>> = [];
  const texts: Array<[number, number, string, number]> = [];

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
    if (code === "0" && value === "ARC") {
      const entity = readEntity(pairs, index + 2);
      arcs.push([
        Number(entity["10"] || 0),
        Number(entity["20"] || 0),
        Number(entity["40"] || 0),
        Number(entity["50"] || 0),
        Number(entity["51"] || 0)
      ]);
    }
    if (code === "0" && value === "POINT") {
      const entity = readEntity(pairs, index + 2);
      points.push([Number(entity["10"] || 0), Number(entity["20"] || 0)]);
    }
    if (code === "0" && value === "LWPOLYLINE") {
      const entityPairs = readEntityPairs(pairs, index + 2);
      const polyline = readPolylinePoints(entityPairs);
      if (polyline.length > 1) {
        polylines.push(polyline);
      }
    }
    if (code === "0" && value === "POLYLINE") {
      const result = readLegacyPolyline(pairs, index + 2);
      if (result.points.length > 1) {
        polylines.push(result.points);
      }
      index = Math.max(index, result.endIndex - 2);
    }
    if (code === "0" && (value === "TEXT" || value === "MTEXT")) {
      const entity = readEntity(pairs, index + 2);
      const text = normalizeDxfText(entity["1"] || entity["3"] || "");
      if (text) {
        texts.push([
          Number(entity["10"] || 0),
          Number(entity["20"] || 0),
          text,
          Math.max(1, Number(entity["40"] || 12))
        ]);
      }
    }
  }

  const section = createSection(`DXF 基础预览`);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "ofv-svg-stage");

  const bounds = computeBounds(lines, circles, arcs, points, polylines, texts);
  const initialViewBox = {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.width,
    height: bounds.height
  };
  let currentViewBox = { ...initialViewBox };
  const applyViewBox = () => {
    svg.setAttribute(
      "viewBox",
      `${currentViewBox.x} ${currentViewBox.y} ${currentViewBox.width} ${currentViewBox.height}`
    );
  };
  applyViewBox();

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

  for (const [cx, cy, radius, startAngle, endAngle] of arcs.slice(0, 1000)) {
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute("d", arcPath(cx, -cy, Math.abs(radius), -startAngle, -endAngle));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#7c3aed");
    path.setAttribute("stroke-width", String(bounds.stroke));
    svg.append(path);
  }

  for (const polyline of polylines.slice(0, 2000)) {
    const path = document.createElementNS(svg.namespaceURI, "polyline");
    path.setAttribute("points", polyline.map(([x, y]) => `${x},${-y}`).join(" "));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#0f766e");
    path.setAttribute("stroke-width", String(bounds.stroke));
    svg.append(path);
  }

  for (const [x, y] of points.slice(0, 3000)) {
    const point = document.createElementNS(svg.namespaceURI, "circle");
    point.setAttribute("cx", String(x));
    point.setAttribute("cy", String(-y));
    point.setAttribute("r", String(bounds.stroke * 2));
    point.setAttribute("fill", "#dc2626");
    svg.append(point);
  }

  for (const [x, y, text, height] of texts.slice(0, 500)) {
    const label = document.createElementNS(svg.namespaceURI, "text");
    label.setAttribute("x", String(x));
    label.setAttribute("y", String(-y));
    label.setAttribute("font-size", String(Math.max(height, bounds.stroke * 8)));
    label.setAttribute("fill", "currentColor");
    label.textContent = text;
    svg.append(label);
  }

  const note = document.createElement("p");
  note.innerHTML = escapeHtml(
    `已提取 LINE ${lines.length} 个、CIRCLE ${circles.length} 个、ARC ${arcs.length} 个、POLYLINE ${polylines.length} 个、POINT ${points.length} 个、TEXT ${texts.length} 个。`
  );
  section.append(note, svg);
  panel.append(section);

  return {
    command(command) {
      if (command === "zoom-in" || command === "zoom-out") {
        const factor = command === "zoom-in" ? 0.82 : 1.18;
        const centerX = currentViewBox.x + currentViewBox.width / 2;
        const centerY = currentViewBox.y + currentViewBox.height / 2;
        currentViewBox.width *= factor;
        currentViewBox.height *= factor;
        currentViewBox.x = centerX - currentViewBox.width / 2;
        currentViewBox.y = centerY - currentViewBox.height / 2;
        applyViewBox();
        return true;
      }
      if (command === "zoom-reset") {
        currentViewBox = { ...initialViewBox };
        applyViewBox();
        return true;
      }
      return false;
    }
  };
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

function readEntityPairs(pairs: string[], start: number): Array<[string, string]> {
  const entityPairs: Array<[string, string]> = [];
  for (let index = start; index < pairs.length; index += 2) {
    const code = pairs[index];
    const value = pairs[index + 1];
    if (code === "0") {
      break;
    }
    entityPairs.push([code, value]);
  }
  return entityPairs;
}

function readPolylinePoints(entityPairs: Array<[string, string]>): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  let x: number | undefined;
  for (const [code, value] of entityPairs) {
    if (code === "10") {
      x = Number(value);
    }
    if (code === "20" && x !== undefined) {
      points.push([x, Number(value)]);
      x = undefined;
    }
  }
  return points;
}

function readLegacyPolyline(
  pairs: string[],
  start: number
): { points: Array<[number, number]>; endIndex: number } {
  const points: Array<[number, number]> = [];
  for (let index = start; index < pairs.length; index += 2) {
    const code = pairs[index];
    const value = pairs[index + 1];
    if (code === "0" && value === "SEQEND") {
      return { points, endIndex: index + 2 };
    }
    if (code === "0" && value === "VERTEX") {
      const entity = readEntity(pairs, index + 2);
      points.push([Number(entity["10"] || 0), Number(entity["20"] || 0)]);
    }
  }
  return { points, endIndex: pairs.length };
}

function normalizeDxfText(text: string): string {
  return text
    .replace(/\\P/g, "\n")
    .replace(/\{\\[^;]+;/g, "")
    .replace(/[{}]/g, "")
    .trim();
}

function arcPath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const delta = Math.abs(endAngle - startAngle);
  const largeArc = delta <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDegrees: number): { x: number; y: number } {
  const angle = (angleDegrees * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle)
  };
}

function computeBounds(
  lines: Array<[number, number, number, number]>,
  circles: Array<[number, number, number]>,
  arcs: Array<[number, number, number, number, number]>,
  points: Array<[number, number]>,
  polylines: Array<Array<[number, number]>>,
  texts: Array<[number, number, string, number]>
): { minX: number; minY: number; width: number; height: number; stroke: number } {
  const xs = lines.flatMap(([x1, , x2]) => [x1, x2]);
  const ys = lines.flatMap(([, y1, , y2]) => [-y1, -y2]);
  for (const [cx, cy, radius] of circles) {
    xs.push(cx - radius, cx + radius);
    ys.push(-cy - radius, -cy + radius);
  }
  for (const [cx, cy, radius] of arcs) {
    xs.push(cx - radius, cx + radius);
    ys.push(-cy - radius, -cy + radius);
  }
  for (const [x, y] of points) {
    xs.push(x);
    ys.push(-y);
  }
  for (const polyline of polylines) {
    for (const [x, y] of polyline) {
      xs.push(x);
      ys.push(-y);
    }
  }
  for (const [x, y, text, height] of texts) {
    xs.push(x, x + text.length * height * 0.6);
    ys.push(-y, -y - height);
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
