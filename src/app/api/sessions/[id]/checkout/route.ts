import { NextResponse } from "next/server";
import { getSession, updateSessionStatus } from "@/lib/sessions";
import { priceFor } from "@/lib/pricing";
import { generatePaymentLink, PayPlusError } from "@/lib/payplus";
import { env } from "@/lib/env";
import { serverClient } from "@/lib/supabase";
import { isStickerSize, type StickerSize } from "@/lib/prodigi-catalog";
import { markOrderPaid, submitOrderForPrinting } from "@/lib/orders";

export const runtime = "nodejs";

type CheckoutBody = {
  size: StickerSize;
  quantity: number;
  address: {
    name: string;
    street: string;
    city: string;
    zip: string;
    country: string;
    phone?: string;
    email?: string;
  };
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const session = await getSession(id);
  if (!session) {
    return NextResponse.json({ error: "session-not-found" }, { status: 404 });
  }

  let body: CheckoutBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  const { size, quantity, address } = body;
  if (!size || !quantity) {
    return NextResponse.json({ error: "config-incomplete" }, { status: 400 });
  }
  if (!isStickerSize(size)) {
    return NextResponse.json({ error: "invalid-size" }, { status: 400 });
  }
  if (quantity < 1 || quantity > 50) {
    return NextResponse.json({ error: "invalid-quantity" }, { status: 400 });
  }
  if (!address?.name || !address.street || !address.city || !address.zip) {
    return NextResponse.json({ error: "address-incomplete" }, { status: 400 });
  }
  if (!session.imagePath) {
    return NextResponse.json({ error: "image-missing" }, { status: 400 });
  }

  const price = priceFor(size, quantity);

  // Persist the order row up-front. Print pipeline picks this up after
  // payment (or immediately, in test mode).
  const sb = serverClient();
  const { data: order, error: orderErr } = await sb
    .from("orders")
    .insert({
      session_id: session.id,
      phone_e164: session.phoneE164,
      email: address.email ?? null,
      image_url: session.imagePath,
      print_image_url: session.imagePath,
      size_mm: size,
      cut_type: "kiss_cut",
      quantity,
      shipping_address: address,
      product_cost_agorot: price.productAgorot,
      shipping_cost_agorot: price.shippingAgorot,
      total_agorot: price.totalAgorot,
    })
    .select()
    .single();
  if (orderErr || !order) {
    return NextResponse.json(
      { error: `db-insert-failed: ${orderErr?.message ?? "no row"}` },
      { status: 502 },
    );
  }

  await updateSessionStatus(session.id, "configuring");
  const appUrl = env.appUrl();

  // --- Test mode: PayPlus disabled. Mark paid + submit to Prodigi as a
  //     draft order, redirect to the order confirmation page. Flip
  //     PAYMENTS_ENABLED=true to re-enable the PayPlus path.
  if (process.env.PAYMENTS_ENABLED !== "true") {
    await markOrderPaid(order.id, "test-mode");
    const submission = await submitOrderForPrinting(order.id);
    return NextResponse.json({
      mode: "test",
      orderId: order.id,
      redirectUrl: `${appUrl}/order/${order.id}`,
      submission,
      breakdown: price,
    });
  }

  // --- Live mode: PayPlus.
  try {
    const result = await generatePaymentLink({
      amount: price.totalAgorot / 100,
      currencyCode: "ILS",
      moreInfo: `order:${order.id}`,
      refUrlSuccess: `${appUrl}/payment/success?order=${order.id}`,
      refUrlFailure: `${appUrl}/payment/failure?order=${order.id}`,
      refUrlCallback: `${appUrl}/api/webhooks/payplus`,
    });
    return NextResponse.json({
      mode: "live",
      orderId: order.id,
      redirectUrl: result.paymentPageLink,
      paymentPageLink: result.paymentPageLink,
      pageRequestUid: result.pageRequestUid,
      breakdown: price,
    });
  } catch (e) {
    if (e instanceof PayPlusError) {
      return NextResponse.json(
        { error: e.message, raw: e.raw, orderId: order.id },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e), orderId: order.id },
      { status: 500 },
    );
  }
}
