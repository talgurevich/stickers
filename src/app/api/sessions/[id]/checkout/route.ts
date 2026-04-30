import { NextResponse } from "next/server";
import { getSession, updateSessionStatus } from "@/lib/sessions";
import { priceFor } from "@/lib/pricing";
import { generatePaymentLink, PayPlusError } from "@/lib/payplus";
import { env } from "@/lib/env";
import { serverClient } from "@/lib/supabase";
import type { CutType, SizeMm } from "@/lib/printful-catalog";

export const runtime = "nodejs";

type CheckoutBody = {
  sizeMm: SizeMm;
  cut: CutType;
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
  const { sizeMm, cut, quantity, address } = body;
  if (!sizeMm || !cut || !quantity) {
    return NextResponse.json({ error: "config-incomplete" }, { status: 400 });
  }
  if (![50, 70, 100].includes(sizeMm)) {
    return NextResponse.json({ error: "invalid-sizeMm" }, { status: 400 });
  }
  if (!["kiss_cut", "rectangle"].includes(cut)) {
    return NextResponse.json({ error: "invalid-cut" }, { status: 400 });
  }
  if (quantity < 1 || quantity > 50) {
    return NextResponse.json({ error: "invalid-quantity" }, { status: 400 });
  }
  if (!address?.name || !address.street || !address.city || !address.zip) {
    return NextResponse.json({ error: "address-incomplete" }, { status: 400 });
  }
  if (!session.imageUrl) {
    return NextResponse.json({ error: "image-missing" }, { status: 400 });
  }

  const price = priceFor(sizeMm, cut, quantity);

  // Persist the order row up-front so the PayPlus IPN has something to mark
  // paid when the callback arrives. Print pipeline picks this up post-payment.
  const sb = serverClient();
  const { data: order, error: orderErr } = await sb
    .from("orders")
    .insert({
      session_id: session.id,
      phone_e164: session.phoneE164,
      email: address.email ?? null,
      image_url: session.imageUrl,
      print_image_url: session.imageUrl, // upscale pipeline TBD; same image for now
      size_mm: sizeMm,
      cut_type: cut,
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
      paymentPageLink: result.paymentPageLink,
      pageRequestUid: result.pageRequestUid,
      orderId: order.id,
      breakdown: price,
    });
  } catch (e) {
    if (e instanceof PayPlusError) {
      return NextResponse.json({ error: e.message, raw: e.raw }, { status: 502 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
