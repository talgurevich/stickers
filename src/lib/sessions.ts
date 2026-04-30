// Session store — abstracts persistence behind a stable interface so we can
// swap the in-memory Map for Supabase the moment it lands.
//
// Mirrors the `sessions` row shape from BRIEF.md / supabase/migrations/0001_init.sql.
// Adds a `config` block for in-progress configurator state (kept here rather
// than a separate row to keep the swap simple).

import { randomUUID } from "node:crypto";
import type { CutType, SizeMm } from "./printful-catalog";

export type SessionStatus =
  | "awaiting_image"
  | "image_received"
  | "configuring"
  | "paid"
  | "abandoned"
  | "expired";

export type ShippingAddress = {
  name: string;
  street: string;
  city: string;
  zip: string;
  country: string; // ISO-3166 alpha-2 — MVP is "IL" only
  phone?: string;
  email?: string;
};

export type SessionConfig = {
  sizeMm?: SizeMm;
  cut?: CutType;
  quantity?: number;
  address?: ShippingAddress;
};

export type Session = {
  id: string;
  phoneE164: string;
  status: SessionStatus;
  imageUrl?: string;
  /** Mime type of the processed image, e.g. "image/png". */
  imageMime?: string;
  config: SessionConfig;
  createdAt: string;
  expiresAt: string;
};

const TTL_MIN = 60;
const store = new Map<string, Session>();
const imageBlobs = new Map<string, { mime: string; buffer: Buffer }>();

function nowPlusMin(min: number): string {
  return new Date(Date.now() + min * 60_000).toISOString();
}

export function createSession(phoneE164: string): Session {
  const session: Session = {
    id: randomUUID(),
    phoneE164,
    status: "awaiting_image",
    config: {},
    createdAt: new Date().toISOString(),
    expiresAt: nowPlusMin(TTL_MIN),
  };
  store.set(session.id, session);
  return session;
}

export function getSession(id: string): Session | null {
  const s = store.get(id);
  if (!s) return null;
  if (new Date(s.expiresAt).getTime() < Date.now()) {
    store.delete(id);
    imageBlobs.delete(id);
    return null;
  }
  return s;
}

export function updateSession(
  id: string,
  patch: Partial<Pick<Session, "status" | "imageUrl" | "imageMime">> & {
    config?: Partial<SessionConfig>;
  },
): Session | null {
  const s = store.get(id);
  if (!s) return null;
  if (patch.status !== undefined) s.status = patch.status;
  if (patch.imageUrl !== undefined) s.imageUrl = patch.imageUrl;
  if (patch.imageMime !== undefined) s.imageMime = patch.imageMime;
  if (patch.config) s.config = { ...s.config, ...patch.config };
  return s;
}

/** Stores a processed image buffer for a session. Returns the URL we expose. */
export function attachImage(
  id: string,
  buffer: Buffer,
  mime: string,
): { url: string } | null {
  const s = store.get(id);
  if (!s) return null;
  imageBlobs.set(id, { mime, buffer });
  const url = `/api/sessions/${id}/image`;
  s.imageUrl = url;
  s.imageMime = mime;
  s.status = "image_received";
  return { url };
}

export function readImage(id: string): { mime: string; buffer: Buffer } | null {
  return imageBlobs.get(id) ?? null;
}
