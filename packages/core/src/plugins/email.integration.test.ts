import { afterEach, describe, expect, it, vi } from "vitest";
import { createViewer } from "../viewer";
import { emailPlugin } from "./email";

describe("emailPlugin integration", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("renders multipart HTML emails with Chinese content and attachments", async () => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:email-integration"),
      revokeObjectURL: vi.fn()
    });
    const container = document.createElement("div");
    document.body.append(container);

    const viewer = createViewer({
      container,
      file: new Blob([sampleInvoiceEmail()], { type: "message/rfc822" }),
      fileName: "invoice.eml",
      plugins: [emailPlugin()]
    });

    await waitFor(() => Boolean(container.querySelector(".ofv-email-body-iframe")), 1000, () => container.textContent);

    const iframe = container.querySelector<HTMLIFrameElement>(".ofv-email-body-iframe");
    await waitFor(
      () => iframe?.contentDocument?.body?.textContent?.includes("请下载附件") === true,
      1000,
      () => container.textContent
    );

    const attachments = Array.from(container.querySelectorAll(".ofv-email-attachment-item"));
    expect(container.textContent).toContain("【沃尔玛】电子发票");
    expect(iframe?.getAttribute("sandbox")).toBe("allow-same-origin allow-popups allow-popups-to-escape-sandbox");
    expect(iframe?.contentDocument?.body?.textContent).toContain("查收您的电子发票");
    expect(attachments).toHaveLength(3);
    expect(attachments.map((item) => item.textContent).join(" ")).toContain("invoice.ofd");
    expect(attachments.map((item) => item.textContent).join(" ")).toContain("invoice.pdf");
    expect(attachments.map((item) => item.textContent).join(" ")).toContain("invoice.xml");

    viewer.destroy();
  });
});

function sampleInvoiceEmail(): string {
  return [
    "From: =?UTF-8?B?5rKD5bCU546b?= <auth@example.com>",
    "To: user@example.com",
    "Subject: =?UTF-8?B?44CQ5rKD5bCU546b44CR55S15a2Q5Y+R56Wo?=",
    "Date: Thu, 18 Jun 2026 14:57:00 +0800",
    "MIME-Version: 1.0",
    'Content-Type: multipart/mixed; boundary="invoice-boundary"',
    "",
    "--invoice-boundary",
    'Content-Type: text/html; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    b64("<div><p>尊敬的用户：<br>【请下载附件，查收您的电子发票】</p><p>请点击链接下载附件，或下载邮件中的附件。</p></div>"),
    "--invoice-boundary",
    'Content-Type: application/octet-stream; name="invoice.ofd"',
    'Content-Disposition: attachment; filename="invoice.ofd"',
    "Content-Transfer-Encoding: base64",
    "",
    b64("ofd"),
    "--invoice-boundary",
    'Content-Type: application/pdf; name="invoice.pdf"',
    'Content-Disposition: attachment; filename="invoice.pdf"',
    "Content-Transfer-Encoding: base64",
    "",
    b64("%PDF"),
    "--invoice-boundary",
    'Content-Type: application/xml; name="invoice.xml"',
    'Content-Disposition: attachment; filename="invoice.xml"',
    "Content-Transfer-Encoding: base64",
    "",
    b64("<xml/>"),
    "--invoice-boundary--",
    ""
  ].join("\r\n");
}

function b64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

async function waitFor(predicate: () => boolean, timeout = 1000, debug?: () => string): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeout) {
      throw new Error(`Timed out waiting for condition.${debug ? `\n${debug()}` : ""}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
