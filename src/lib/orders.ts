// Order lifecycle — between PayPlus IPN and Printful submission.
//
// On payment-success: mark the order paid, then create a Printful order using
// the variant ID from our matrix and a signed image URL Printful can fetch.
// Persist printful_order_id back on the row.
//
// Idempotent: callable multiple times for the same order (e.g. PayPlus
// IPN retries) — we no-op if already paid+submitted.

import { serverClient, STORAGE_BUCKET } from "./supabase";
import { createOrder as printfulCreateOrder, PrintfulError } from "./printful";
import { getVariantId, type CutType, type SizeMm } from "./printful-catalog";

const PRINT_URL_TTL_SEC = 7 * 24 * 60 * 60; // 7 days — covers Printful pulling the file at production time

export type OrderRow = {
  id: string;
  session_id: string | null;
  phone_e164: string;
  email: string | null;
  image_url: string;
  print_image_url: string;
  size_mm: SizeMm;
  cut_type: CutType;
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
  printful_order_id: string | null;
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

/**
 * Build a fresh long-lived signed URL for Printful to pull the print file from.
 * Storage path lives in print_image_url (or image_url as fallback).
 */
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
  | { kind: "submitted"; printfulOrderId: number }
  | { kind: "already-submitted"; printfulOrderId: string }
  | { kind: "no-variant"; sizeMm: SizeMm; cut: CutType }
  | { kind: "error"; message: string };

/**
 * Send the order to Printful. Idempotent — if printful_order_id is already
 * set, returns the existing id without recreating.
 */
export async function submitOrderToPrintful(
  orderId: string,
): Promise<SubmitResult> {
  const order = await getOrder(orderId);
  if (!order) return { kind: "error", message: "order-not-found" };

  if (order.printful_order_id) {
    return { kind: "already-submitted", printfulOrderId: order.printful_order_id };
  }

  const variantId = getVariantId(order.cut_type, order.size_mm);
  if (!variantId) {
    return {
      kind: "no-variant",
      sizeMm: order.size_mm,
      cut: order.cut_type,
    };
  }

  const printFileUrl = await signPrintFile(order);
  const a = order.shipping_address;

  try {
    const r = await printfulCreateOrder({
      // Printful caps external_id at 32 chars; UUIDs with dashes are 36.
      // Strip dashes — still unique, deterministic, reversible.
      external_id: order.id.replace(/-/g, ""),
      recipient: {
        name: a.name,
        address1: a.street,
        city: a.city,
        country_code: a.country,
        zip: a.zip,
        phone: a.phone ?? order.phone_e164,
        email: a.email ?? order.email ?? undefined,
      },
      items: [
        {
          quantity: order.quantity,
          catalog_variant_id: variantId,
          source: "catalog",
          placements: [
            {
              placement: "default",
              technique: "digital",
              layers: [{ type: "file", url: printFileUrl }],
            },
          ],
        },
      ],
    });

    const printfulOrderId = r.data.id;
    await serverClient()
      .from("orders")
      .update({
        printful_order_id: String(printfulOrderId),
        printful_status: r.data.status ?? "submitted",
      })
      .eq("id", orderId);

    return { kind: "submitted", printfulOrderId };
  } catch (e) {
    if (e instanceof PrintfulError) {
      return { kind: "error", message: e.message };
    }
    return {
      kind: "error",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
