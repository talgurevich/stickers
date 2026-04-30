import { NextResponse } from "next/server";
import { greenApi } from "@/lib/greenapi";
import { env } from "@/lib/env";
import { ingestInboundMedia } from "@/lib/whatsapp-ingest";

export const runtime = "nodejs";

// Inbound WhatsApp from Green API.
//
// Webhook URL is configured in the Green API dashboard. Validate a shared
// secret either via ?secret= query param or X-Webhook-Secret header so a
// random scanner can't trigger session matching.
export async function POST(req: Request) {
  const expected = env.greenApi().webhookSecret;
  if (expected) {
    const provided =
      new URL(req.url).searchParams.get("secret") ||
      req.headers.get("x-webhook-secret");
    if (provided !== expected) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  const typeWebhook = (body as { typeWebhook?: string })?.typeWebhook;
  console.log("[whatsapp inbound:received]", { typeWebhook });

  const msg = greenApi.parseWebhook(body);
  if (!msg) {
    console.log("[whatsapp inbound:ignored]", {
      typeWebhook,
      bodySample: JSON.stringify(body).slice(0, 600),
    });
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Only image / sticker messages carry the print payload. Other types
  // (text, audio, video) are ignored for ingest but still ack'd.
  if (!msg.mediaUrl) {
    if (msg.type === "textMessage") {
      // Optional: light-touch reply for users who text instead of sending an image.
      try {
        await greenApi.sendText(
          msg.senderPhone,
          "שלחו לי בבקשה את המדבקה כסטיקר או כתמונה (PNG/JPG).",
        );
      } catch {
        // Non-critical; carry on.
      }
    }
    return NextResponse.json({ ok: true, ignored: true });
  }

  const result = await ingestInboundMedia({
    phoneE164: msg.senderPhone,
    mediaUrl: msg.mediaUrl,
    whatsappMessageId: msg.messageId,
  });

  console.log("[whatsapp inbound]", {
    from: msg.senderPhone,
    type: msg.type,
    messageId: msg.messageId,
    result,
  });

  // Best-effort acknowledgement back to the sender.
  if (result.kind === "matched") {
    try {
      await greenApi.sendText(
        msg.senderPhone,
        "קיבלנו את המדבקה. חזרו לאתר כדי לבחור גודל וכמות.",
      );
    } catch {
      /* swallow */
    }
  } else if (result.kind === "orphaned") {
    try {
      await greenApi.sendText(
        msg.senderPhone,
        "קיבלנו את המדבקה אבל לא מצאנו הזמנה פתוחה לטלפון הזה. כנסו ל־wallaura.art ופתחו הזמנה חדשה — נחבר אוטומטית.",
      );
    } catch {
      /* swallow */
    }
  }

  return NextResponse.json({ ok: true, result });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
