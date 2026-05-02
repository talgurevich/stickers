import { NextResponse } from "next/server";
import { serverClient, STORAGE_BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";

const SIGNED_URL_TTL_SEC = 60 * 60;

function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0") && digits.length === 10) return "972" + digits.slice(1);
  if (digits.length === 9) return "972" + digits;
  if (digits.startsWith("972")) return digits;
  return digits;
}

// MVP: no auth — anyone can list orders by phone. Test mode only.
// TODO before live: WhatsApp OTP — issue a code via greenApi.sendText, user
// enters it, set a signed cookie that scopes /api/account/* to that phone.
export async function POST(req: Request) {
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
  const { data, error } = await sb
    .from("orders")
    .select(
      "id, product_type, size_mm, quantity, total_agorot, paid_at, printful_order_id, printful_status, image_url, created_at",
    )
    .eq("phone_e164", phone)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  // Mint signed thumbnails per row so the account page can render previews.
  const rows = data ?? [];
  const enriched = await Promise.all(
    rows.map(async (r) => {
      let thumbUrl: string | null = null;
      if (r.image_url) {
        const { data: signed } = await sb.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(r.image_url as string, SIGNED_URL_TTL_SEC);
        thumbUrl = signed?.signedUrl ?? null;
      }
      return {
        id: r.id,
        productType: (r as { product_type?: string }).product_type ?? "sticker",
        size: r.size_mm,
        quantity: r.quantity,
        totalAgorot: r.total_agorot,
        paidAt: r.paid_at,
        fulfillmentId: r.printful_order_id,
        fulfillmentStatus: r.printful_status,
        createdAt: r.created_at,
        thumbUrl,
      };
    }),
  );

  return NextResponse.json({ phone, orders: enriched });
}
