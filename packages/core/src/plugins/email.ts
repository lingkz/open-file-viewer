import type { PreviewPlugin } from "../types";
import { appendMeta, createPanel, createSection, escapeHtml, readTextFile } from "./utils";

const emailExtensions = new Set(["eml", "msg", "mbox"]);

export function emailPlugin(): PreviewPlugin {
  return {
    name: "email",
    match(file) {
      return emailExtensions.has(file.extension);
    },
    async render(ctx) {
      const panel = createPanel("ofv-email");
      ctx.viewport.append(panel);

      if (ctx.file.extension === "msg") {
        const section = createSection("MSG 邮件预览");
        section.append("MSG 是 Outlook 复合二进制格式，当前版本先识别并提示，后续可接入 msgreader 或服务端转换。");
        panel.append(section);
        return { destroy: () => panel.remove() };
      }

      const raw = await readTextFile(ctx.file);
      const parsed = parseEml(raw);
      const header = createSection("邮件信息");
      appendMeta(header, "From", parsed.headers.from || "-");
      appendMeta(header, "To", parsed.headers.to || "-");
      appendMeta(header, "Subject", parsed.headers.subject || "-");
      appendMeta(header, "Date", parsed.headers.date || "-");

      const body = createSection("正文");
      const content = document.createElement("pre");
      content.className = "ofv-text-block";
      content.innerHTML = escapeHtml(parsed.body || "未解析到正文。");
      body.append(content);

      panel.append(header, body);
      return {
        destroy() {
          panel.remove();
        }
      };
    }
  };
}

function parseEml(raw: string): { headers: Record<string, string>; body: string } {
  const normalized = raw.replace(/\r\n/g, "\n");
  const [headerText = "", ...bodyParts] = normalized.split(/\n\n/);
  const headers: Record<string, string> = {};
  let currentKey = "";

  for (const line of headerText.split("\n")) {
    if (/^\s/.test(line) && currentKey) {
      headers[currentKey] = `${headers[currentKey]} ${line.trim()}`;
      continue;
    }
    const index = line.indexOf(":");
    if (index > 0) {
      currentKey = line.slice(0, index).toLowerCase();
      headers[currentKey] = line.slice(index + 1).trim();
    }
  }

  return {
    headers,
    body: bodyParts.join("\n\n").trim()
  };
}
