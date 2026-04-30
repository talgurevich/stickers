// Order lifecycle — between PayPlus IPN and Prodigi submission.
//
// On payment-success: mark the order paid, then create a Prodigi order with
// the right SKU (from prodigi-catalog) and a signed image URL Prodigi can
// pull during fulfillment. Persist prodigi_order_id back on the row.
//
// Idempotent: callable multiple times for the same order — re-runs short-
// circuit if a fulfillment id already exists.

import { serverClient, STORAGE_BUCKET } from "./supabase";
import { createOrder as prodigiCreateOrder, ProdigiError } from "./prodigi";
import {
  STICKER_VARIANTS,
  isStickerSize,
  type StickerSize,
} from "./prodigi-catalog";

const PRINT_URL_TTL_SEC = 7 * 24 * 60 * 60; // 7 days — covers Prodigi pulling the file at production time

export type OrderRow = {
  id: string;
  session_id: string | null;
  phone_e164: string;
  email: string | null;
  image_url: string;
  print_image_url: string;
  /**
   * Re-purposed: stores the Prodigi sticker size key ("small" | "medium" | "large" | "xlarge").
   * The column was originally an int sized to Printful's 50/70/100 mm options;
   * the check constraint was dropped in 0003_prodigi_sizes.sql.
   */
  size_mm: StickerSize | string;
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
};

export async function getOrder(id: string): Promise<OrderRow | null> {
  const { data } = await serverClient()
    .from("orders")
    .select()
    .eq("id", id)
    .maybeSingle();
  return (data as OrderRow) ?? null;
}

export async function markOrderPaid(
  id: string,
  payplusTransactionId: string | null,
): Promise<OrderRow | null> {
  const { data, error } = await serverClient()
    .from("orders")
    .update({
      payplus_transaction_id: payplusTransactionId,
      paid_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error || !data) return null;
  return data as OrderRow;
}

async function signPrintFile(order: OrderRow): Promise<string> {
  const path = order.print_image_url || order.image_url;
  const { data, error } = await serverClient()
    .storage.from(STORAGE_BUCKET)
    .createSignedUrl(path, PRINT_URL_TTL_SEC);
  if (error || !data?.signedUrl) {
    throw new Error(`failed to sign print file: ${error?.message ?? "no url"}`);
  }
  return data.signedUrl;
}

export type SubmitResult =
  | { kind: "submitted"; fulfillmentOrderId: string }
  | { kind: "already-submitted"; fulfillmentOrderId: string }
  | { kind: "no-variant"; size: string }
  | { kind: "error"; message: string };

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

  if (!isStickerSize(order.size_mm)) {
    return { kind: "no-variant", size: String(order.size_mm) };
  }
  const variant = STICKER_VARIANTS[order.size_mm];

  const printFileUrl = await signPrintFile(order);
  const a = order.shipping_address;

  try {
    const r = await prodigiCreateOrder({
      // Prodigi accepts free-form merchantReference; UUID with or without
      // dashes both fit (no length cap surfaced in docs / observed errors).
      merchantReference: order.id,
      shippingMethod: "Standard",
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
