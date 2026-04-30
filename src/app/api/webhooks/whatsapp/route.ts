import { NextResponse } from "next/server";
import { greenApi } from "@/lib/greenapi";
import { env } from "@/lib/env";

export const runtime = "nodejs";

// Inbound WhatsApp messages from Green API.
//
// Webhook URL is configured in the Green API dashboard. We validate a shared
// secret either via ?secret= query param or X-Webhook-Secret header so a
// random scanner can't trigger session matching.
//
// TODO once Supabase is wired (build step 4):
//   - look up open session by senderPhone, advance status, set image_url
//   - else insert into whatsapp_orphans with 15-min TTL
//   - if phone mismatch, reply via greenApi.sendText asking user to send from
//     the right number
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

  const msg = greenApi.parseWebhook(body);
  if (!msg) {
    // Not an inbound message we care about — still 200 so the gateway
    // doesn't keep retrying.
    return NextResponse.json({ ok: true, ignored: true });
  }

  console.log("[whatsapp inbound]", {
    from: msg.senderPhone,
    type: msg.type,
    hasMedia: Boolean(msg.mediaUrl),
    messageId: msg.messageId,
  });

  return NextResponse.json({ ok: true });
}

// Some gateways verify webhook URLs with a GET probe — accept it.
export async function GET() {
  return NextResponse.json({ ok: true });
}
