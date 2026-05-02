// Inbox view for /start/[id]: every image currently available for the
// session's phone — both the matched session image (if attached) and any
// unmatched WhatsApp orphans within their 15-min TTL. The gallery on
// /start/[id] polls this endpoint to surface multi-sticker batches.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/sessions";
import { serverClient, STORAGE_BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";

const SIGNED_URL_TTL_SEC = 60 * 60;

export type InboxItem =
  | {
      kind: "session";
      sessionId: string;
      imagePath: string;
      imageUrl: string | null;
      receivedAt: string | null;
    }
  | {
      kind: "orphan";
      orphanId: string;
      imagePath: string;
      imageUrl: string | null;
      receivedAt: string;
    };

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const session = await getSession(id);
  if (!session) {
    return NextResponse.json({ error: "session-not-found" }, { status: 404 });
  }

  const sb = serverClient();
  const items: InboxItem[] = [];

  // The session's matched image, if any.
  if (session.imagePath) {
    items.push({
      kind: "session",
      sessionId: session.id,
      imagePath: session.imagePath,
      imageUrl: session.imageUrl,
      receivedAt: null,
    });
  }

  // Unmatched orphans for this phone within TTL. Newest first so the most
  // recent send is at the top of the gallery.
  const { data: orphans } = await sb
    .from("whatsapp_orphans")
    .select("id, image_url, received_at")
    .eq("phone_e164", session.phoneE164)
    .is("matched_to_session_id", null)
    .gt("expires_at", new Date().toISOString())
    .order("received_at", { ascending: false })
    .limit(20);

  for (const r of orphans ?? []) {
    const { data } = await sb.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(r.image_url as string, SIGNED_URL_TTL_SEC);
    items.push({
      kind: "orphan",
      orphanId: r.id as string,
      imagePath: r.image_url as string,
      imageUrl: data?.signedUrl ?? null,
      receivedAt: r.received_at as string,
    });
  }

  return NextResponse.json({
    phone: session.phoneE164,
    items,
  });
}
