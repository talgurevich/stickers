// WhatsApp inbound ingestion: shared logic between the live webhook and
// the orphan sweep that fires when a new session opens.
//
// Given a phone (E.164, digits only) and a media URL, downloads, processes
// with sharp, uploads to Storage, and links to the right session — either
// an open session for that phone, or a fresh whatsapp_orphans row.

import sharp from "sharp";
import { serverClient, STORAGE_BUCKET } from "./supabase";

async function downloadMedia(url: string): Promise<Buffer> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`media download HTTP ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function processToPng(input: Buffer): Promise<Buffer> {
  return sharp(input, { animated: false }).png().toBuffer();
}

export type IngestResult =
  | { kind: "matched"; sessionId: string }
  | { kind: "orphaned"; orphanId: string }
  | { kind: "skipped"; reason: string };

/**
 * Find an open session for this phone, attach the image, advance status.
 * No match → write a whatsapp_orphans row for the next-session sweep.
 */
export async function ingestInboundMedia(args: {
  phoneE164: string;
  mediaUrl: string;
  whatsappMessageId: string;
}): Promise<IngestResult> {
  const sb = serverClient();

  // 1) Look up an open session for this phone. Most-recent first.
  const { data: open } = await sb
    .from("sessions")
    .select("id")
    .eq("phone_e164", args.phoneE164)
    .eq("status", "awaiting_image")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 2) Download + process unconditionally — we always store the bytes
  //    (matched session uses them now, orphan still needs them later).
  let png: Buffer;
  try {
    const raw = await downloadMedia(args.mediaUrl);
    png = await processToPng(raw);
  } catch (e) {
    return {
      kind: "skipped",
      reason: e instanceof Error ? e.message : String(e),
    };
  }

  if (open) {
    // Per-message path so two parallel webhooks for the same session
    // don't overwrite each other's bytes. The conditional UPDATE below
    // (WHERE status = 'awaiting_image') is the CAS that decides whose
    // bytes the session points to — the loser falls through to orphan
    // creation, ensuring all three of three quick-fire stickers are
    // visible to the gallery (was: 2-of-3 due to race).
    const path = `${open.id}/wa-${args.whatsappMessageId}.png`;
    const up = await sb.storage
      .from(STORAGE_BUCKET)
      .upload(path, png, { contentType: "image/png", upsert: true });
    if (up.error) {
      return { kind: "skipped", reason: `upload: ${up.error.message}` };
    }
    const { data: updated, error: updErr } = await sb
      .from("sessions")
      .update({ image_url: path, status: "image_received" })
      .eq("id", open.id)
      .eq("status", "awaiting_image")
      .select()
      .maybeSingle();
    if (updErr) {
      return { kind: "skipped", reason: `db: ${updErr.message}` };
    }
    if (updated) {
      return { kind: "matched", sessionId: open.id };
    }
    // Lost the race: another inbound for the same session won the CAS.
    // Fall through to orphan creation so this sticker still surfaces in
    // the /start/[id] gallery. The bytes already uploaded above are
    // wasted but harmless — they'll be GC'd with the session bucket.
  }

  // No open session — store as an orphan. Use a temp path keyed by message id.
  const orphanPath = `orphans/${args.whatsappMessageId}.png`;
  const up = await sb.storage
    .from(STORAGE_BUCKET)
    .upload(orphanPath, png, { contentType: "image/png", upsert: true });
  if (up.error) {
    return { kind: "skipped", reason: `orphan upload: ${up.error.message}` };
  }
  const { data: orphan, error: orphanErr } = await sb
    .from("whatsapp_orphans")
    .insert({
      phone_e164: args.phoneE164,
      image_url: orphanPath,
      whatsapp_message_id: args.whatsappMessageId,
    })
    .select()
    .single();
  if (orphanErr || !orphan) {
    return { kind: "skipped", reason: `orphan db: ${orphanErr?.message ?? "no row"}` };
  }
  return { kind: "orphaned", orphanId: orphan.id as string };
}

/**
 * When a new session opens for a phone, check for an unmatched orphan within
 * TTL and adopt it. Returns whether an image was attached.
 */
export async function sweepOrphansForSession(args: {
  sessionId: string;
  phoneE164: string;
}): Promise<boolean> {
  const sb = serverClient();
  const { data: orphan } = await sb
    .from("whatsapp_orphans")
    .select("id, image_url")
    .eq("phone_e164", args.phoneE164)
    .is("matched_to_session_id", null)
    .gt("expires_at", new Date().toISOString())
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!orphan) return false;

  // Move the bytes from orphan path to session path.
  const sessionPath = `${args.sessionId}/sticker.png`;
  const { error: moveErr } = await sb.storage
    .from(STORAGE_BUCKET)
    .move(orphan.image_url, sessionPath);
  if (moveErr) {
    // If the orphan blob is gone, we still mark the orphan matched so we
    // don't keep retrying — but skip the session attach.
    await sb
      .from("whatsapp_orphans")
      .update({ matched_to_session_id: args.sessionId })
      .eq("id", orphan.id);
    return false;
  }

  await sb
    .from("sessions")
    .update({ image_url: sessionPath, status: "image_received" })
    .eq("id", args.sessionId);
  await sb
    .from("whatsapp_orphans")
    .update({ matched_to_session_id: args.sessionId })
    .eq("id", orphan.id);
  return true;
}
