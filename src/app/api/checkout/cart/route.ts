// Cart-level checkout. Multiple sticker designs ship in a single parcel —
// one Prodigi order, one PayPlus payment, one shipping fee. Each line item
// gets its own `orders` row tied together by a shared `cart_id` so the
// existing webhook + email plumbing can keep operating row-at-a-time.

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSession } from "@/lib/sessions";
import { priceForCart } from "@/lib/pricing";
import { generatePaymentLink, PayPlusError } from "@/lib/payplus";
import { env } from "@/lib/env";
import { serverClient, STORAGE_BUCKET } from "@/lib/supabase";
import {
  isProductType,
  isSizeForProduct,
  type ProductType,
} from "@/lib/prodigi-catalog";
import { isSupportedCountry, type CountryCode } from "@/lib/countries";
import {
  markCartPaid,
  submitCartForPrinting,
  getCartOrders,
} from "@/lib/orders";
import { sendOrderConfirmation, sendOwnerOrderNotification } from "@/lib/email";
import { notifyCheckoutStarted } from "@/lib/slack";
import { applyDiscount, redeemCoupon } from "@/lib/coupons";

export const runtime = "nodejs";

type Address = {
  name: string;
  street: string;
  city: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
};

type CartItem = {
  sessionId: string;
  imagePath?: string; // optional client hint; we re-resolve from session
  productType?: ProductType; // optional for legacy clients (defaults to sticker)
  size: string;
  quantity: number;
};

type CartCheckoutBody = {
  items: CartItem[];
  address: Address;
  displayPublicly?: boolean;
  couponCode?: string;
};

export async function POST(req: Request) {
  let body: CartCheckoutBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  const { items, address } = body;
  const displayPublicly = body.displayPublicly !== false;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "cart-empty" }, { status: 400 });
  }
  if (!address?.name || !address.street || !address.city || !address.zip) {
    return NextResponse.json({ error: "address-incomplete" }, { status: 400 });
  }
  if (!isSupportedCountry(address.country)) {
    return NextResponse.json(
      { error: `unsupported-country:${address.country}` },
      { status: 400 },
    );
  }
  const country: CountryCode = address.country;
  // Email is required: it's the channel for order confirmation, shipping
  // updates, and any post-fulfillment support contact.
  if (!address.email || !/\S+@\S+\.\S+/.test(address.email)) {
    return NextResponse.json({ error: "email-required" }, { status: 400 });
  }

  // Validate items + resolve image paths from sessions. We trust the client's
  // imagePath only as a fallback for sessions that have already expired —
  // session.imagePath is the authoritative source when the session is alive.
  type Resolved = {
    sessionId: string | null;
    phoneE164: string | null;
    imagePath: string;
    productType: ProductType;
    size: string;
    quantity: number;
  };
  const resolved: Resolved[] = [];
  for (const it of items) {
    const productType: ProductType = isProductType(it.productType)
      ? it.productType
      : "sticker";
    if (!isSizeForProduct(productType, it.size)) {
      return NextResponse.json(
        { error: `invalid-size:${productType}/${it.size}` },
        { status: 400 },
      );
    }
    if (!it.quantity || it.quantity < 1 || it.quantity > 50) {
      return NextResponse.json(
        { error: `invalid-quantity:${it.sessionId}` },
        { status: 400 },
      );
    }
    const session = it.sessionId ? await getSession(it.sessionId) : null;
    const imagePath = session?.imagePath ?? it.imagePath ?? null;
    if (!imagePath) {
      return NextResponse.json(
        { error: `image-missing:${it.sessionId}` },
        { status: 400 },
      );
    }
    resolved.push({
      sessionId: session?.id ?? null,
      phoneE164: session?.phoneE164 ?? null,
      imagePath,
      productType,
      size: it.size,
      quantity: it.quantity,
    });
  }

  // Use the first session's phone as the cart's contact phone. (All sessions
  // in a cart should belong to the same user — they're created from the same
  // browser. We don't enforce this at the DB layer.)
  const cartPhone =
    resolved.find((r) => r.phoneE164)?.phoneE164 ?? "0000000000";

  const price = priceForCart(
    resolved.map((r) => ({
      productType: r.productType,
      size: r.size,
      quantity: r.quantity,
    })),
    country,
  );

  // Coupon — atomically redeem (increments used_count) before we create the
  // PayPlus link, so two simultaneous checkouts can't both squeeze past the
  // last available use. If the user typed a code that's invalid/exhausted,
  // fail the checkout — the UI should have warned them via /api/coupons/validate.
  let couponCode: string | null = null;
  let discountAgorot = 0;
  let finalAgorot = price.totalAgorot;
  if (body.couponCode) {
    const redeem = await redeemCoupon(body.couponCode);
    if (!redeem.ok) {
      return NextResponse.json(
        { error: `coupon-${redeem.reason}` },
        { status: 400 },
      );
    }
    couponCode = redeem.coupon.code;
    const applied = applyDiscount(price.totalAgorot, redeem.coupon.discountPercent);
    discountAgorot = applied.discountAgorot;
    finalAgorot = applied.finalAgorot;
  }

  const cartId = randomUUID();
  const sb = serverClient();

  // Insert one orders row per line item. Shipping + handling are charged
  // once for the whole cart, so we apply them entirely to the first row;
  // remaining rows store 0 for both. Sum across rows = cart total — keeps
  // the existing per-row total semantics intact.
  const rowsToInsert = resolved.map((r, idx) => {
    const lineProductAgorot = price.lines[idx].productAgorot;
    const isFirst = idx === 0;
    const lineShipping = isFirst ? price.shippingAgorot : 0;
    const lineHandling = isFirst ? price.handlingAgorot : 0;
    // Discount + coupon code are stored on the first row only — same pattern
    // as shipping/handling. Sum across rows = the actual paid amount.
    const lineDiscount = isFirst ? discountAgorot : 0;
    return {
      cart_id: cartId,
      session_id: r.sessionId,
      phone_e164: r.phoneE164 ?? cartPhone,
      email: address.email ?? null,
      image_url: r.imagePath,
      print_image_url: r.imagePath,
      size_mm: r.size,
      product_type: r.productType,
      cut_type: "kiss_cut",
      quantity: r.quantity,
      shipping_address: address,
      product_cost_agorot: lineProductAgorot,
      shipping_cost_agorot: lineShipping,
      total_agorot: lineProductAgorot + lineShipping + lineHandling - lineDiscount,
      display_publicly: displayPublicly,
      coupon_code: isFirst ? couponCode : null,
      discount_agorot: lineDiscount,
    };
  });

  const { data: insertedRows, error: insertErr } = await sb
    .from("orders")
    .insert(rowsToInsert)
    .select();
  if (insertErr || !insertedRows) {
    return NextResponse.json(
      { error: `db-insert-failed: ${insertErr?.message ?? "no rows"}` },
      { status: 502 },
    );
  }

  const appUrl = env.appUrl();
  const isTestMode = process.env.PAYMENTS_ENABLED !== "true";

  const totalQuantityForNotice = resolved.reduce((n, r) => n + r.quantity, 0);
  const productTypesForNotice = new Set(resolved.map((r) => r.productType));
  const cartProductTypeForNotice =
    productTypesForNotice.size === 1
      ? resolved[0].productType
      : "mixed";
  void notifyCheckoutStarted({
    orderId: `cart:${cartId} (${resolved.length} items)`,
    phone: cartPhone,
    email: address.email ?? null,
    productType: cartProductTypeForNotice,
    size: resolved.length === 1 ? resolved[0].size : "mixed",
    quantity: totalQuantityForNotice,
    totalAgorot: finalAgorot,
    country,
    mode: isTestMode ? "test" : "live",
  });

  // --- Test mode: PayPlus disabled. Mark cart paid + submit single multi-
  //     item Prodigi draft, redirect to the cart confirmation page.
  if (isTestMode) {
    await markCartPaid(cartId, "test-mode");
    const submission = await submitCartForPrinting(cartId);

    // Best-effort confirmation email — picks the first item's image as the
    // visual and lists totals at the cart level. Skips silently if RESEND
    // isn't configured or no email was given.
    let firstImageUrl: string | null = null;
    if (resolved[0]?.imagePath) {
      const { data } = await sb.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(resolved[0].imagePath, 7 * 24 * 60 * 60);
      firstImageUrl = data?.signedUrl ?? null;
    }

    const totalQuantity = resolved.reduce((n, r) => n + r.quantity, 0);
    // Mixed cart: if all lines share the same product type, show that
    // type; otherwise mark the order as "mixed" so the email copy uses
    // generic wording ("המוצרים").
    const productTypes = new Set(resolved.map((r) => r.productType));
    const cartProductType: ProductType | "mixed" =
      productTypes.size === 1
        ? (resolved[0].productType as ProductType)
        : "mixed";

    const customerEmailResult = address.email
      ? await sendOrderConfirmation({
          to: address.email,
          orderId: cartId,
          productType: cartProductType,
          size: resolved.length === 1 ? resolved[0].size : "mixed",
          quantity: totalQuantity,
          totalAgorot: finalAgorot,
          imageUrl: firstImageUrl,
          shippingName: address.name,
          shippingCity: address.city,
        })
      : { kind: "skipped", reason: "no-email" as const };

    const ownerEmailResult = await sendOwnerOrderNotification({
      orderId: cartId,
      productType: cartProductType,
      size: resolved.length === 1 ? resolved[0].size : `mixed (${resolved.length} items)`,
      quantity: totalQuantity,
      totalAgorot: finalAgorot,
      customerPhone: cartPhone,
      customerEmail: address.email ?? null,
      imageUrl: firstImageUrl,
      shippingName: address.name,
      shippingStreet: address.street,
      shippingCity: address.city,
      shippingZip: address.zip,
      fulfillmentId:
        submission.kind === "submitted" || submission.kind === "already-submitted"
          ? submission.fulfillmentOrderId
          : null,
      fulfillmentStatus:
        submission.kind === "error"
          ? `error: ${submission.message}`
          : submission.kind,
    });

    return NextResponse.json({
      mode: "test",
      cartId,
      orderIds: (await getCartOrders(cartId)).map((o) => o.id),
      redirectUrl: `${appUrl}/cart/${cartId}`,
      submission,
      email: customerEmailResult,
      ownerEmail: ownerEmailResult,
      breakdown: price,
    });
  }

  // --- Live mode: PayPlus single payment for the cart total (after coupon).
  // Forward customer details from the address form so PayPlus shows a real
  // person on the transaction (instead of the default "General Customer").
  try {
    const customer = address.email
      ? {
          customer_name: address.name,
          email: address.email,
          phone: address.phone ?? `+${cartPhone}`,
          address: address.street,
          city: address.city,
          country_ISO: address.country,
        }
      : undefined;
    const result = await generatePaymentLink({
      amount: finalAgorot / 100,
      currencyCode: "ILS",
      moreInfo: `cart:${cartId}`,
      refUrlSuccess: `${appUrl}/payment/success?cart=${cartId}`,
      refUrlFailure: `${appUrl}/payment/failure?cart=${cartId}`,
      refUrlCallback: `${appUrl}/api/webhooks/payplus`,
      customer,
    });
    return NextResponse.json({
      mode: "live",
      cartId,
      redirectUrl: result.paymentPageLink,
      paymentPageLink: result.paymentPageLink,
      pageRequestUid: result.pageRequestUid,
      breakdown: { ...price, discountAgorot, finalAgorot, couponCode },
    });
  } catch (e) {
    if (e instanceof PayPlusError) {
      return NextResponse.json(
        { error: e.message, raw: e.raw, cartId },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e), cartId },
      { status: 500 },
    );
  }
}
