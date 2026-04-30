import { NextResponse } from "next/server";
import { serverClient, STORAGE_BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";

const SIGNED_URL_TTL_SEC = 60 * 60;
const LIMIT = 12;

// Public feed of recently fulfilled orders. Returns minimal data only —
// thumbnail URL, size, approximate timestamp. NO phone, name, address,
// email or order id. Use anon-safe data only since this endpoint is
// reachable without auth from the homepage.
//
// TODO before public launch: add an opt-in flag at checkout time (a
// `display_publicly` column on orders) and filter on it here. The privacy
// policy currently does not disclose public display of submitted images.
export async function GET() {
  const sb = serverClient();
  const { data, error } = await sb
    .from("orders")
    .select("id, image_url, size_mm, created_at")
    .not("printful_order_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  const items = await Promise.all(
    (data ?? []).map(async (r) => {
      let thumbUrl: string | null = null;
      if (r.image_url) {
        const { data: signed } = await sb.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(r.image_url as string, SIGNED_URL_TTL_SEC);
        thumbUrl = signed?.signedUrl ?? null;
      }
      return {
        id: r.id, // Internal — not displayed to user. Used as React key only.
        thumbUrl,
        size: r.size_mm as string,
        createdAt: r.created_at,
      };
    }),
  );

  // Cache for 60s on Vercel's edge — feed doesn't need to be perfectly
  // fresh and we'd rather not slam Supabase + Storage on every page load.
  return NextResponse.json(
    { items: items.filter((i) => i.thumbUrl) },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    },
  );
}
