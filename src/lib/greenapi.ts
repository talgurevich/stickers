// Green API gateway adapter. Implements WhatsAppAdapter so the rest of the
// app can ignore which WhatsApp provider is in use.
//
// Endpoint pattern: {baseUrl}/waInstance{id}/{method}/{token}
// Outbound docs: https://green-api.com/en/docs/api/

import { env } from "./env";
import type { IncomingMessage, WhatsAppAdapter } from "./whatsapp";

function endpoint(method: string): string {
  const cfg = env.greenApi();
  return `${cfg.baseUrl.replace(/\/$/, "")}/waInstance${cfg.instanceId}/${method}/${cfg.token}`;
}

async function call<T>(method: string, body?: unknown): Promise<T> {
  const res = await fetch(endpoint(method), {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `Non-JSON response from Green API ${method} (HTTP ${res.status}): ${text.slice(0, 200)}`,
    );
  }
  if (!res.ok) {
    throw new Error(
      `Green API ${method} failed: HTTP ${res.status} ${JSON.stringify(json).slice(0, 300)}`,
    );
  }
  return json as T;
}

function toChatId(phoneE164: string): string {
  // Green API expects digits-only + "@c.us"
  const digits = phoneE164.replace(/\D/g, "");
  return `${digits}@c.us`;
}

export const greenApi: WhatsAppAdapter = {
  async isAuthorized() {
    const r = await call<{ stateInstance?: string }>("getStateInstance");
    return r.stateInstance === "authorized";
  },

  async sendText(phoneE164, text) {
    await call("sendMessage", { chatId: toChatId(phoneE164), message: text });
  },

  async sendImageByUrl(phoneE164, imageUrl, opts) {
    await call("sendFileByUrl", {
      chatId: toChatId(phoneE164),
      urlFile: imageUrl,
      fileName: opts?.fileName ?? "sticker.png",
      caption: opts?.caption,
    });
  },

  parseWebhook(body): IncomingMessage | null {
    const b = body as {
      typeWebhook?: string;
      idMessage?: string;
      senderData?: { sender?: string; chatId?: string };
      messageData?: {
        typeMessage?: string;
        fileMessageData?: {
          downloadUrl?: string;
          fileName?: string;
          mimeType?: string;
        };
        stickerMessageData?: {
          downloadUrl?: string;
          fileName?: string;
        };
      };
    };

    if (b?.typeWebhook !== "incomingMessageReceived") return null;

    const senderRaw = b.senderData?.sender ?? b.senderData?.chatId ?? "";
    const senderPhone = senderRaw.split("@")[0]?.replace(/\D/g, "") ?? "";
    if (!senderPhone) return null;

    const type = b.messageData?.typeMessage ?? "other";
    const file = b.messageData?.fileMessageData;
    const sticker = b.messageData?.stickerMessageData;
    const mediaUrl = file?.downloadUrl ?? sticker?.downloadUrl;
    const fileName = file?.fileName ?? sticker?.fileName;

    return {
      senderPhone,
      messageId: b.idMessage ?? "",
      type,
      mediaUrl,
      fileName,
      raw: body,
    };
  },
};
