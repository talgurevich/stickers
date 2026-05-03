import { NextResponse } from "next/server";
import {
  getCartOrders,
  markCartPaid,
  submitCartForPrinting,
} from "@/lib/orders";
import { sendOrderConfirmation, sendOwnerOrderNotification } from "@/lib/email";
import { serverClient, STORAGE_BUCKET } from "@/lib/supabase";
import { isProductType, type ProductType } from "@/lib/prodigi-catalog";

export const runtime = "nodejs";

// One-shot backfill for carts that were paid via PayPlus but never made it
// through the webhook flow (e.g. early IPN parsing bugs). Mirrors the
// webhook's cart handler. Idempotent — safe to re-run.
//
// POST /api/admin/backfill-cart  body: { cartId: string, transactionId?: string }
export async function POST(req: Request) {
  let body: { cartId?: string; transactionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  const cartId = body.cartId;
  if (!cartId) {
    return NextResponse.json({ error: "missing-cartId" }, { status: 400 });
  }

  const before = await getCartOrders(cartId);
  if (before.length === 0) {
    return NextResponse.json({ error: "cart-not-found", cartId }, { status: 404 });
  }

  // Atomic claim — same gate as the webhook. Concurrent backfill+webhook can't
  // both submit to Prodigi. If the cart is already paid (markCartPaid returns []),
  // we skip submission entirely; the rare "paid in DB but never made it to
  // Prodigi" case must be handled by clearing printful_order_id manually first.
  const justPaid = await markCartPaid(cartId, body.transactionId ?? "backfill");
  const wasAlreadyPaid = justPaid.length === 0;

  let email: unknown = { kind: "skipped", reason: "already-paid" };
  let ownerEmail: unknown = { kind: "skipped", reason: "already-paid" };
  const submission =
    justPaid.length > 0
      ? await submitCartForPrinting(cartId)
      : ({ kind: "already-submitted", fulfillmentOrderId: "" } as const);

  if (!wasAlreadyPaid && justPaid.length > 0) {
    const first = justPaid[0];
    const a = first.shipping_address;
    const totalAgorot = justPaid.reduce((n, r) => n + (r.total_agorot ?? 0), 0);

    const items = await Promise.all(
      justPaid.map(async (r) => ({
        productType: isProductType(r.product_type)
          ? (r.product_type as ProductType)
          : ("sticker" as ProductType),
        size: r.size_mm,
        quantity: r.quantity,
        imageUrl: await signedImage(r.print_image_url || r.image_url),
      })),
    );

    if (first.email) {
      email = await sendOrderConfirmation({
        to: first.email,
        orderId: cartId,
        items,
        totalAgorot,
        shippingName: a.name,
        shippingCity: a.city,
      });
    } else {
      email = { kind: "skipped", reason: "no-email" };
    }

    ownerEmail = await sendOwnerOrderNotification({
      orderId: cartId,
      items,
      totalAgorot,
      customerPhone: first.phone_e164,
      customerEmail: first.email,
      shippingName: a.name,
      shippingStreet: a.street,
      shippingCity: a.city,
      shippingZip: a.zip,
      fulfillmentId:
        submission.kind === "submitted" || submission.kind === "already-submitted"
          ? submission.fulfillmentOrderId
          : null,
      fulfillmentStatus:
        submission.kind === "error" ? `error: ${submission.message}` : submission.kind,
    });
  }

  return NextResponse.json({
    ok: true,
    cartId,
    rowsBefore: before.length,
    rowsPaidNow: justPaid.length,
    wasAlreadyPaid,
    submission,
    email,
    ownerEmail,
  });
}

async function signedImage(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await serverClient()
    .storage.from(STORAGE_BUCKET)
    .createSignedUrl(path, 7 * 24 * 60 * 60);
  return data?.signedUrl ?? null;
}
