// Claim a WhatsApp orphan: copy its bytes onto a fresh session and mark
// the orphan as matched. The caller must supply the phone for ownership
// (loose check — same model as /api/account/orders/reorder; replace with
// cookie auth once OTP lands).

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { serverClient, STORAGE_BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";

function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0") && digits.length === 10) return "972" + digits.slice(1);
  if (digits.length === 9) return "972" + digits;
  if (digits.startsWith("972")) return digits;
  return digits;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: orphanId } = await ctx.params;
  let body: { phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  const phone = body.phone ? normalizePhone(body.phone) : null;
  if (!phone) {
    return NextResponse.json({ error: "invalid-phone" }, { status: 400 });
  }

  const sb = serverClient();

  const { data: orphan } = await sb
    .from("whatsapp_orphans")
    .select("id, phone_e164, image_url, matched_to_session_id, expires_at")
    .eq("id", orphanId)
    .maybeSingle();
  if (!orphan) {
    return NextResponse.json({ error: "orphan-not-found" }, { status: 404 });
  }
  if (orphan.matched_to_session_id) {
    return NextResponse.json({ error: "already-claimed" }, { status: 409 });
  }
  if (orphan.phone_e164 !== phone) {
    return NextResponse.json({ error: "phone-mismatch" }, { status: 403 });
  }
  if (new Date(orphan.expires_at as string) < new Date()) {
    return NextResponse.json({ error: "orphan-expired" }, { status: 410 });
  }

  // Move the bytes from the orphan path to a fresh session path. We use
  // copy (not move) because two parallel claim requests for the same
  // orphan should both fail safely on the DB update; the storage move
  // would be irreversible.
  const newSessionId = randomUUID();
  const newPath = `${newSessionId}/sticker.png`;
  const copy = await sb.storage
    .from(STORAGE_BUCKET)
    .copy(orphan.image_url as string, newPath);
  if (copy.error) {
    return NextResponse.json(
      { error: `copy: ${copy.error.message}` },
      { status: 502 },
    );
  }

  // Insert the session row before flagging the orphan matched, so a
  // failure here doesn't strand the orphan in the matched state.
  const { data: session, error: insErr } = await sb
    .from("sessions")
    .insert({
      id: newSessionId,
      phone_e164: phone,
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

  // Race-safe claim: only update if still unmatched. If two requests hit
  // simultaneously, the second one's update touches 0 rows and we treat
  // it as an already-claimed conflict (the first already created its own
  // session, so the orphan storage was copied twice but only one orphan
  // row got updated — small wasted blob, no user-visible bug).
  const { data: claimed } = await sb
    .from("whatsapp_orphans")
    .update({ matched_to_session_id: newSessionId })
    .eq("id", orphanId)
    .is("matched_to_session_id", null)
    .select()
    .maybeSingle();
  if (!claimed) {
    return NextResponse.json({ error: "race-lost" }, { status: 409 });
  }

  return NextResponse.json({ sessionId: newSessionId });
}
