// Session store backed by Supabase.
//
// `image_url` in the DB stores the bucket-relative path (e.g. "<id>/sticker.png").
// On read, we mint a fresh signed URL for the client — bucket is private and
// signed URLs expire, so storing a permanent URL is wrong. The client-facing
// Session shape exposes `imageUrl` as the signed URL.
//
// Configurator state (size / cut / quantity / address) is intentionally NOT
// persisted on `sessions` — per the brief, sessions track image acquisition
// only; configurator state lives on the client and gets serialized into an
// `orders` row at checkout time.

import { serverClient, STORAGE_BUCKET } from "./supabase";

const SIGNED_URL_TTL_SEC = 60 * 60;

export type SessionStatus =
  | "awaiting_image"
  | "image_received"
  | "configuring"
  | "paid"
  | "abandoned"
  | "expired";

export type Session = {
  id: string;
  phoneE164: string;
  status: SessionStatus;
  /** Signed URL ready for the browser; null when no image attached yet. */
  imageUrl: string | null;
  createdAt: string;
  expiresAt: string;
};

type Row = {
  id: string;
  phone_e164: string;
  status: SessionStatus;
  image_url: string | null;
  created_at: string;
  expires_at: string;
};

async function rowToSession(r: Row): Promise<Session> {
  let signed: string | null = null;
  if (r.image_url) {
    const { data } = await serverClient()
      .storage.from(STORAGE_BUCKET)
      .createSignedUrl(r.image_url, SIGNED_URL_TTL_SEC);
    signed = data?.signedUrl ?? null;
  }
  return {
    id: r.id,
    phoneE164: r.phone_e164,
    status: r.status,
    imageUrl: signed,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
  };
}

export async function createSession(phoneE164: string): Promise<Session> {
  const { data, error } = await serverClient()
    .from("sessions")
    .insert({ phone_e164: phoneE164 })
    .select()
    .single();
  if (error || !data) {
    throw new Error(`createSession failed: ${error?.message ?? "no row"}`);
  }
  return rowToSession(data as Row);
}

export async function getSession(id: string): Promise<Session | null> {
  const { data, error } = await serverClient()
    .from("sessions")
    .select()
    .eq("id", id)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !data) return null;
  return rowToSession(data as Row);
}

export async function updateSessionStatus(
  id: string,
  status: SessionStatus,
): Promise<Session | null> {
  const { data, error } = await serverClient()
    .from("sessions")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error || !data) return null;
  return rowToSession(data as Row);
}

/** Uploads buffer to the stickers bucket and saves the path on the session. */
export async function attachImage(
  id: string,
  buffer: Buffer,
  mime: string,
): Promise<Session | null> {
  const ext = mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : "bin";
  const path = `${id}/sticker.${ext}`;
  const sb = serverClient();
  const up = await sb.storage.from(STORAGE_BUCKET).upload(path, buffer, {
    contentType: mime,
    upsert: true,
  });
  if (up.error) throw new Error(`upload failed: ${up.error.message}`);

  const { data, error } = await sb
    .from("sessions")
    .update({ image_url: path, status: "image_received" })
    .eq("id", id)
    .select()
    .single();
  if (error || !data) return null;
  return rowToSession(data as Row);
}
