import { NextResponse } from "next/server";
import { serverClient, STORAGE_BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";

// Vercel Cron handler.
//
// Vercel sends `Authorization: Bearer <CRON_SECRET>` on cron-triggered
// invocations. We require that header on POST requests to keep this
// endpoint from being called by anyone with the URL.
//
// Schedule lives in vercel.json — every 5 minutes.
//
// Tasks:
//   1) expire sessions past expires_at that haven't converted (status
//      not in ('paid')) → delete row + Storage blobs under <id>/
//   2) delete orphan rows past expires_at that never matched
//      → delete row + Storage blob at orphans/<message-id>.png
async function isAuthorized(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  // If no secret configured (e.g. preview/dev), allow only in non-production.
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}

async function run(req: Request) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = serverClient();
  const now = new Date().toISOString();
  const result: Record<string, unknown> = {};

  // 1) Expired sessions that never converted.
  const { data: expiredSessions } = await sb
    .from("sessions")
    .select("id, image_url")
    .lt("expires_at", now)
    .neq("status", "paid")
    .limit(200);
  result.expiredSessionsFound = expiredSessions?.length ?? 0;

  if (expiredSessions?.length) {
    const ids = expiredSessions.map((s) => s.id as string);
    // Delete Storage blobs (folder-style — one image per session).
    const paths: string[] = [];
    for (const s of expiredSessions) {
      if (s.image_url) paths.push(s.image_url as string);
    }
    if (paths.length) {
      await sb.storage.from(STORAGE_BUCKET).remove(paths);
    }
    const del = await sb.from("sessions").delete().in("id", ids);
    result.sessionsDeleted = del.error ? 0 : ids.length;
  }

  // 2) Expired unmatched orphans.
  const { data: expiredOrphans } = await sb
    .from("whatsapp_orphans")
    .select("id, image_url")
    .lt("expires_at", now)
    .is("matched_to_session_id", null)
    .limit(200);
  result.expiredOrphansFound = expiredOrphans?.length ?? 0;

  if (expiredOrphans?.length) {
    const ids = expiredOrphans.map((o) => o.id as string);
    const paths = expiredOrphans
      .map((o) => o.image_url as string)
      .filter(Boolean);
    if (paths.length) {
      await sb.storage.from(STORAGE_BUCKET).remove(paths);
    }
    const del = await sb.from("whatsapp_orphans").delete().in("id", ids);
    result.orphansDeleted = del.error ? 0 : ids.length;
  }

  return NextResponse.json({ ok: true, at: now, ...result });
}
