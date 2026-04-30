import { NextResponse } from "next/server";
import { serverClient, STORAGE_BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";

// Debug: confirm Supabase connectivity, that the migration ran, and that the
// stickers Storage bucket exists. POST creates the bucket if it doesn't yet.
// Throw-away once everything is wired.
export async function POST() {
  try {
    const sb = serverClient();
    const list = await sb.storage.listBuckets();
    if (list.data?.some((b) => b.name === STORAGE_BUCKET)) {
      return NextResponse.json({ ok: true, created: false, bucket: STORAGE_BUCKET });
    }
    const { error } = await sb.storage.createBucket(STORAGE_BUCKET, {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return NextResponse.json({ ok: true, created: true, bucket: STORAGE_BUCKET });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}

export async function GET() {
  try {
    const sb = serverClient();
    const tables: Record<string, unknown> = {};
    for (const t of ["sessions", "orders", "whatsapp_orphans"] as const) {
      const r = await sb.from(t).select("*", { count: "exact", head: true });
      if (r.error) {
        tables[t] = { error: r.error.message };
      } else if (r.count === null) {
        tables[t] = { error: "table-not-found-or-no-permission" };
      } else {
        tables[t] = { count: r.count };
      }
    }
    const buckets = await sb.storage.listBuckets();
    const bucketsOut = buckets.error
      ? { error: buckets.error.message }
      : (buckets.data ?? []).map((b) => b.name);
    return NextResponse.json({
      tables,
      buckets: bucketsOut,
      bucket_present: Array.isArray(bucketsOut)
        ? bucketsOut.includes(STORAGE_BUCKET)
        : false,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
