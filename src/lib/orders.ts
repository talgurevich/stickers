// Order lifecycle — between PayPlus IPN and Prodigi submission.
//
// On payment-success: mark the order paid, then create a Prodigi order with
// the right SKU (from prodigi-catalog) and a signed image URL Prodigi can
// pull during fulfillment. Persist prodigi_order_id back on the row.
//
// Idempotent: callable multiple times for the same order — re-runs short-
// circuit if a fulfillment id already exists.

import sharp from "sharp";
import { serverClient, STORAGE_BUCKET } from "./supabase";
import {
  createOrder as prodigiCreateOrder,
  ProdigiError,
  prodigiCallbackUrl,
} from "./prodigi";
import { notifyPaymentCompleted } from "./slack";
import {
  isProductType,
  variantFor,
  type ProductType,
  type ProductVariant,
  type StickerSize,
} from "./prodigi-catalog";
import {
  isSupportedCountry,
  type CountryCode,
} from "./countries";
import { SHIPPING_METHOD_BY_COUNTRY } from "./pricing";

const PRINT_URL_TTL_SEC = 7 * 24 * 60 * 60; // 7 days — covers Prodigi pulling the file at production time

export type OrderRow = {
  id: string;
  session_id: string | null;
  cart_id: string | null;
  phone_e164: string;
  email: string | null;
  image_url: string;
  print_image_url: string;
  /**
   * Re-purposed: stores the Prodigi size key for the row's product_type.
   * For stickers: "small" | "medium" | "large" | "xlarge".
   * For magnets: "small" | "large".
   * For tattoos: "s" | "m" | "l".
   * Column was originally an int sized to Printful's 50/70/100 mm options;
   * the check constraint was dropped in 0003_prodigi_sizes.sql.
   */
  size_mm: StickerSize | string;
  /** Product line — added in migration 0006. Defaults to 'sticker' for legacy rows. */
  product_type: ProductType;
  cut_type: string;
  quantity: number;
  shipping_address: {
    name: string;
    street: string;
    city: string;
    zip: string;
    country: string;
    phone?: string;
    email?: string;
  };
  payplus_transaction_id: string | null;
  paid_at: string | null;
  printful_order_id: string | null; // re-purposed: holds Prodigi order id (ord_…)
  printful_status: string | null;
  shipped_at: string | null;
  tracking_url: string | null;
  total_agorot: number;
};

export async function getOrder(id: string): Promise<OrderRow | null> {
  const { data } = await serverClient()
    .from("orders")
    .select()
    .eq("id", id)
    .maybeSingle();
  return (data as OrderRow) ?? null;
}

/**
 * Atomic "claim" of an unpaid order: returns the row only if THIS call
 * transitioned paid_at from null → set. Returns null if the order was
 * already paid by a concurrent caller (typical when PayPlus retries the IPN).
 *
 * Use from idempotent code paths (webhook) to gate post-payment side
 * effects. For "force mark as paid" admin paths, use markOrderPaid which
 * always returns the current row.
 */
export async function markOrderPaidIfUnpaid(
  id: string,
  payplusTransactionId: string | null,
): Promise<OrderRow | null> {
  const { data: justPaid } = await serverClient()
    .from("orders")
    .update({
      payplus_transaction_id: payplusTransactionId,
      paid_at: new Date().toISOString(),
    })
    .eq("id", id)
    .is("paid_at", null)
    .select()
    .maybeSingle();

  if (!justPaid) return null;

  const row = justPaid as OrderRow;
  void notifyPaymentCompleted({
    orderId: row.id,
    phone: row.phone_e164,
    email: row.email,
    totalAgorot: row.total_agorot,
    source: payplusTransactionId ?? "unknown",
  });
  return row;
}

export async function markOrderPaid(
  id: string,
  payplusTransactionId: string | null,
): Promise<OrderRow | null> {
  // Filter on paid_at IS NULL so a second call (PayPlus retry, manual rerun)
  // doesn't re-stamp paid_at — and lets us detect a real first-paid event
  // for one-shot notifications.
  const { data: justPaid } = await serverClient()
    .from("orders")
    .update({
      payplus_transaction_id: payplusTransactionId,
      paid_at: new Date().toISOString(),
    })
    .eq("id", id)
    .is("paid_at", null)
    .select()
    .maybeSingle();

  if (justPaid) {
    const row = justPaid as OrderRow;
    void notifyPaymentCompleted({
      orderId: row.id,
      phone: row.phone_e164,
      email: row.email,
      totalAgorot: row.total_agorot,
      source: payplusTransactionId ?? "unknown",
    });
    return row;
  }

  // Already paid (or row missing) — return current state.
  const { data } = await serverClient()
    .from("orders")
    .select()
    .eq("id", id)
    .maybeSingle();
  return (data as OrderRow) ?? null;
}

/**
 * Build the padded print-ready PNG for an order and return a signed URL.
 *
 * Prodigi receives this with `sizing: "fillPrintArea"` — meaning the asset is
 * scaled to fully cover the print area and any aspect mismatch gets cropped.
 * To keep the customer's artwork intact, we pre-pad with transparency to the
 * variant's widthMm/heightMm aspect ratio (per variant, since stickers are
 * square and tattoos are 2:3). Without this, a non-matching upload (e.g. a
 * landscape logo onto a 5×7.5cm tattoo) loses its left/right edges in print.
 *
 * Padded file is stored at a separate path so order-history thumbnails and
 * emails keep showing the customer's untouched original.
 */
async function buildAndSignPrintFile(
  order: OrderRow,
  variant: ProductVariant,
): Promise<string> {
  const sb = serverClient();
  const sourcePath = order.print_image_url || order.image_url;

  const { data: blob, error: dlErr } = await sb.storage
    .from(STORAGE_BUCKET)
    .download(sourcePath);
  if (dlErr || !blob) {
    throw new Error(
      `failed to download source image: ${dlErr?.message ?? "no blob"}`,
    );
  }
  const sourceBuf = Buffer.from(await blob.arrayBuffer());

  const meta = await sharp(sourceBuf).metadata();
  if (!meta.width || !meta.height) {
    throw new Error("source image missing dimensions");
  }

  const targetAspect = variant.widthMm / variant.heightMm;
  const sourceAspect = meta.width / meta.height;

  let top = 0;
  let bottom = 0;
  let left = 0;
  let right = 0;
  if (sourceAspect > targetAspect) {
    // Source wider than target — pad top/bottom.
    const targetH = Math.round(meta.width / targetAspect);
    const extra = targetH - meta.height;
    top = Math.floor(extra / 2);
    bottom = extra - top;
  } else if (sourceAspect < targetAspect) {
    // Source narrower than target — pad left/right.
    const targetW = Math.round(meta.height * targetAspect);
    const extra = targetW - meta.width;
    left = Math.floor(extra / 2);
    right = extra - left;
  }

  const paddedBuf = await sharp(sourceBuf)
    .ensureAlpha()
    .extend({
      top,
      bottom,
      left,
      right,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const printPath = `print/${order.id}-${variant.sku}.png`;
  const up = await sb.storage
    .from(STORAGE_BUCKET)
    .upload(printPath, paddedBuf, {
      contentType: "image/png",
      upsert: true,
    });
  if (up.error) {
    throw new Error(`failed to upload print file: ${up.error.message}`);
  }

  const { data: signed, error: signErr } = await sb.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(printPath, PRINT_URL_TTL_SEC);
  if (signErr || !signed?.signedUrl) {
    throw new Error(
      `failed to sign print file: ${signErr?.message ?? "no url"}`,
    );
  }
  return signed.signedUrl;
}

export type SubmitResult =
  | { kind: "submitted"; fulfillmentOrderId: string }
  | { kind: "already-submitted"; fulfillmentOrderId: string }
  | { kind: "no-variant"; size: string }
  | { kind: "error"; message: string };

// --- Shipped flow ---

export type ShippedResult =
  | { kind: "marked"; orderId: string; trackingUrl: string | null; alreadyShipped: boolean }
  | { kind: "order-not-found" }
  | { kind: "no-shipments" };

/**
 * Given a Prodigi order id, mark our order shipped (idempotently). Returns
 * info the caller can use to dispatch the shipped email.
 *
 * Caller responsibility: send the email — keeping email side-effects out of
 * this function so we can call it from the webhook AND the admin simulator
 * with the same semantics.
 */
export async function markOrderShipped(args: {
  prodigiOrderId: string;
  trackingUrl: string | null;
}): Promise<ShippedResult & { order?: OrderRow }> {
  const sb = serverClient();
  const { data: order } = await sb
    .from("orders")
    .select()
    .eq("printful_order_id", args.prodigiOrderId)
    .maybeSingle();
  if (!order) return { kind: "order-not-found" };
  const row = order as OrderRow;

  const alreadyShipped = Boolean(row.shipped_at);
  if (alreadyShipped) {
    return {
      kind: "marked",
      orderId: row.id,
      trackingUrl: row.tracking_url,
      alreadyShipped: true,
      order: row,
    };
  }

  const now = new Date().toISOString();
  const { data: updated } = await sb
    .from("orders")
    .update({
      shipped_at: now,
      tracking_url: args.trackingUrl,
      printful_status: "Shipped",
    })
    .eq("id", row.id)
    .select()
    .single();

  return {
    kind: "marked",
    orderId: row.id,
    trackingUrl: args.trackingUrl,
    alreadyShipped: false,
    order: (updated as OrderRow) ?? row,
  };
}

// --- Prodigi-side lookup ---

/** All orders attached to a Prodigi order id (single OR multi-item carts). */
export async function getOrdersByProdigi(
  prodigiOrderId: string,
): Promise<OrderRow[]> {
  const { data } = await serverClient()
    .from("orders")
    .select()
    .eq("printful_order_id", prodigiOrderId);
  return (data as OrderRow[]) ?? [];
}

/**
 * Atomic stage transition: bumps printful_status only on rows that aren't
 * already at that stage (or beyond — the caller specifies the precondition).
 * Returns rows that actually transitioned. Use to gate "this is the first
 * time we've seen X" notifications under concurrent webhook delivery.
 */
export async function markOrdersStageIfPriorThan(args: {
  prodigiOrderId: string;
  newStage: string;
  /** Statuses considered "already at or beyond" — these rows are skipped. */
  skipIfStatusIn: string[];
}): Promise<OrderRow[]> {
  const sb = serverClient();
  let q = sb
    .from("orders")
    .update({ printful_status: args.newStage })
    .eq("printful_order_id", args.prodigiOrderId);
  if (args.skipIfStatusIn.length > 0) {
    // Postgres `not.in` filter — rows with these statuses are skipped.
    q = q.not("printful_status", "in", `(${args.skipIfStatusIn.map((s) => `"${s}"`).join(",")})`);
  }
  const { data } = await q.select();
  return (data as OrderRow[]) ?? [];
}

// --- Cart (multi-item) helpers ---

export async function getCartOrders(cartId: string): Promise<OrderRow[]> {
  const { data } = await serverClient()
    .from("orders")
    .select()
    .eq("cart_id", cartId)
    .order("created_at", { ascending: true });
  return (data as OrderRow[]) ?? [];
}

export async function markCartPaid(
  cartId: string,
  payplusTransactionId: string | null,
): Promise<OrderRow[]> {
  // Same idempotency story as markOrderPaid — only rows that flipped from
  // unpaid → paid this call come back, so Slack fires once per cart.
  const { data } = await serverClient()
    .from("orders")
    .update({
      payplus_transaction_id: payplusTransactionId,
      paid_at: new Date().toISOString(),
    })
    .eq("cart_id", cartId)
    .is("paid_at", null)
    .select();

  const justPaid = (data as OrderRow[]) ?? [];
  if (justPaid.length > 0) {
    const totalAgorot = justPaid.reduce((sum, r) => sum + (r.total_agorot ?? 0), 0);
    const first = justPaid[0];
    void notifyPaymentCompleted({
      orderId: `cart:${cartId} (${justPaid.length} items)`,
      phone: first.phone_e164,
      email: first.email,
      totalAgorot,
      source: payplusTransactionId ?? "unknown",
    });
    return justPaid;
  }

  // Already paid (or empty) — return current cart state.
  const { data: current } = await serverClient()
    .from("orders")
    .select()
    .eq("cart_id", cartId);
  return (current as OrderRow[]) ?? [];
}

/**
 * Submit all orders in a cart as a single Prodigi order with multiple items.
 * Same Prodigi order id is stamped on every row so the webhook can find them
 * all by `printful_order_id`. Idempotent — re-runs short-circuit if any row
 * already has a fulfillment id.
 */
export async function submitCartForPrinting(
  cartId: string,
): Promise<SubmitResult> {
  const rows = await getCartOrders(cartId);
  if (rows.length === 0) return { kind: "error", message: "cart-empty" };

  const existing = rows.find((r) => r.printful_order_id);
  if (existing?.printful_order_id) {
    return {
      kind: "already-submitted",
      fulfillmentOrderId: existing.printful_order_id,
    };
  }

  const items = [];
  for (const row of rows) {
    const productType: ProductType = isProductType(row.product_type)
      ? row.product_type
      : "sticker";
    const variant = variantFor(productType, row.size_mm);
    if (!variant) {
      return { kind: "no-variant", size: `${productType}/${row.size_mm}` };
    }
    const printFileUrl = await buildAndSignPrintFile(row, variant);
    items.push({
      sku: variant.sku,
      copies: row.quantity,
      sizing: "fillPrintArea" as const,
      assets: [{ printArea: "default", url: printFileUrl }],
    });
  }

  // Recipient comes from the first row — all rows in a cart share one
  // shipping address by construction (see /api/checkout/cart).
  const first = rows[0];
  const a = first.shipping_address;
  const country: CountryCode = isSupportedCountry(a.country) ? a.country : "IL";
  const shippingMethod = SHIPPING_METHOD_BY_COUNTRY[country];

  try {
    const r = await prodigiCreateOrder({
      merchantReference: cartId,
      shippingMethod,
      callbackUrl: prodigiCallbackUrl(),
      recipient: {
        name: a.name,
        email: a.email ?? first.email ?? undefined,
        phoneNumber: a.phone ?? `+${first.phone_e164}`,
        address: {
          line1: a.street,
          townOrCity: a.city,
          postalOrZipCode: a.zip,
          countryCode: a.country,
        },
      },
      items,
    });

    const fulfillmentOrderId = r.order.id;
    await serverClient()
      .from("orders")
      .update({
        printful_order_id: fulfillmentOrderId,
        printful_status: r.order.status?.stage ?? "submitted",
      })
      .eq("cart_id", cartId);

    return { kind: "submitted", fulfillmentOrderId };
  } catch (e) {
    if (e instanceof ProdigiError) {
      return { kind: "error", message: e.message };
    }
    return {
      kind: "error",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function submitOrderForPrinting(
  orderId: string,
): Promise<SubmitResult> {
  const order = await getOrder(orderId);
  if (!order) return { kind: "error", message: "order-not-found" };

  if (order.printful_order_id) {
    return {
      kind: "already-submitted",
      fulfillmentOrderId: order.printful_order_id,
    };
  }

  const productType: ProductType = isProductType(order.product_type)
    ? order.product_type
    : "sticker";
  const variant = variantFor(productType, order.size_mm);
  if (!variant) {
    return { kind: "no-variant", size: `${productType}/${order.size_mm}` };
  }

  const printFileUrl = await buildAndSignPrintFile(order, variant);
  const a = order.shipping_address;
  const country: CountryCode = isSupportedCountry(a.country) ? a.country : "IL";
  const shippingMethod = SHIPPING_METHOD_BY_COUNTRY[country];

  try {
    const r = await prodigiCreateOrder({
      // Prodigi accepts free-form merchantReference; UUID with or without
      // dashes both fit (no length cap surfaced in docs / observed errors).
      merchantReference: order.id,
      // shippingMethod must match the rate we priced with — pricing.ts
      // picks the cheapest available per country (Budget for IL/EU/UK/CA/AU/TH,
      // Standard for US). Hard-coding Budget would burn ~$36 on US orders.
      shippingMethod,
      callbackUrl: prodigiCallbackUrl(),
      recipient: {
        name: a.name,
        email: a.email ?? order.email ?? undefined,
        phoneNumber: a.phone ?? `+${order.phone_e164}`,
        address: {
          line1: a.street,
          townOrCity: a.city,
          postalOrZipCode: a.zip,
          countryCode: a.country, // "IL" supported
        },
      },
      items: [
        {
          sku: variant.sku,
          copies: order.quantity,
          sizing: "fillPrintArea",
          assets: [{ printArea: "default", url: printFileUrl }],
        },
      ],
    });

    const fulfillmentOrderId = r.order.id;
    await serverClient()
      .from("orders")
      .update({
        printful_order_id: fulfillmentOrderId,
        printful_status: r.order.status?.stage ?? "submitted",
      })
      .eq("id", orderId);

    return { kind: "submitted", fulfillmentOrderId };
  } catch (e) {
    if (e instanceof ProdigiError) {
      return { kind: "error", message: e.message };
    }
    return {
      kind: "error",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
