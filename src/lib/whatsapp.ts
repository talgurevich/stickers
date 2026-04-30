// WhatsApp adapter — abstracts the gateway behind a stable interface so we can
// swap Green API for Meta Cloud API later (see BRIEF.md WhatsApp section).
//
// Inbound: a normalized IncomingMessage shape produced from the gateway's
// webhook payload. Outbound: send text or media-by-URL to a phone number.

export type IncomingMessage = {
  /** Phone number in E.164 (no '+' prefix), e.g. "972541234567" */
  senderPhone: string;
  /** Gateway-provided message ID for dedup */
  messageId: string;
  /** "text" | "image" | "sticker" | "video" | "audio" | "document" | "other" */
  type: string;
  /** Public/temporary URL we can fetch the media from. Empty for text messages. */
  mediaUrl?: string;
  /** Original filename if any. */
  fileName?: string;
  /** Original gateway payload, kept for debugging / future fields. */
  raw: unknown;
};

export interface WhatsAppAdapter {
  /** Health check — returns true when the underlying gateway is ready to send/receive. */
  isAuthorized(): Promise<boolean>;
  sendText(phoneE164: string, text: string): Promise<void>;
  sendImageByUrl(
    phoneE164: string,
    imageUrl: string,
    opts?: { fileName?: string; caption?: string },
  ): Promise<void>;
  /** Parse a webhook payload from the gateway. Returns null if not a relevant inbound message. */
  parseWebhook(body: unknown): IncomingMessage | null;
}
