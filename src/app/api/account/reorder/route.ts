import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { serverClient, STORAGE_BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";

// MVP: copies the order's storage blob to a fresh session keyed for the
// caller's phone, returns the new session id. Configurator opens with the
// image already attached. No auth — see TODO in /api/account/orders.
export async function POST(req: Request) {
  let body: { orderId?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  if (!body.orderId || !body.phone) {
    return NextResponse.json({ error: "missing-fields" }, { status: 400 });
  }

  const sb = serverClient();
  const { data: order } = await sb
    .from("orders")
    .select("id, phone_e164, image_url")
    .eq("id", body.orderId)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ error: "order-not-found" }, { status: 404 });
  }
  // Loose ownership check — phone in body must match order phone. Replace
  // with cookie-based auth once OTP lands.
  const phoneDigits = body.phone.replace(/\D/g, "");
  if (
    !phoneDigits ||
    !order.phone_e164.endsWith(phoneDigits.replace(/^972/, "").replace(/^0/, ""))
  ) {
    return NextResponse.json({ error: "phone-mismatch" }, { status: 403 });
  }

  // Fresh session row.
  const newSessionId = randomUUID();
  const newPath = `${newSessionId}/sticker.png`;
  const copy = await sb.storage
    .from(STORAGE_BUCKET)
    .copy(order.image_url as string, newPath);
  if (copy.error) {
    return NextResponse.json(
      { error: `copy failed: ${copy.error.message}` },
      { status: 502 },
    );
  }

  const { data: session, error: insErr } = await sb
    .from("sessions")
    .insert({
      id: newSessionId,
      phone_e164: order.phone_e164,
      status: "image_received",
      image_url: newPath,
    })
    .select()
    .single();
  if (insErr || !session) {
    return NextResponse.json(
      { error: `session-insert: ${insErr?.message ?? "no row"}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ sessionId: newSessionId });
}
