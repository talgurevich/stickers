import { NextResponse } from "next/server";
import { verifyTransaction } from "@/lib/payplus";
import {
  getOrder,
  getCartOrders,
  markOrderPaidIfUnpaid,
  markCartPaid,
  submitOrderForPrinting,
  submitCartForPrinting,
} from "@/lib/orders";
import { sendOrderConfirmation, sendOwnerOrderNotification } from "@/lib/email";
import { serverClient, STORAGE_BUCKET } from "@/lib/supabase";
import {
  isProductType,
  type ProductType,
} from "@/lib/prodigi-catalog";

export const runtime = "nodejs";

// PayPlus IPN handler.
//
// PayPlus posts here after every transaction (success and failure, since we
// enabled "send callback for failed transactions" in the dashboard). The
// payload is form-urlencoded by default for legacy reasons, JSON when the
// merchant opts in — accept both.
//
// Authenticity: PayPlus does not expose an HMAC for this terminal type, so
// instead of trusting the IPN body we re-query PaymentPages/ipn with the
// transaction_uid. A forged IPN would need a real PayPlus-side transaction
// to pass verification.
//
// Always respond 200 — non-2xx makes PayPlus retry, and our processing is
// idempotent (markOrderPaid / markCartPaid filter on paid_at IS NULL).
export async function POST(req: Request) {
  const contentType = req.headers.get("content-type");
  const raw = await req.text();
  const payload = parseBody(raw, contentType);

  // Log raw body once so we can diagnose unexpected payload shapes.
  console.log("[payplus webhook] raw", {
    contentType,
    length: raw.length,
    bodyPreview: raw.slice(0, 2000),
  });

  const transactionUid = pick(payload, [
    "transaction.uid",
    "transaction_uid",
    "transactionUid",
    "data.transaction_uid",
    "transaction.transaction_uid",
  ]);
  const paymentRequestUid = pick(payload, [
    "transaction.payment_page_request_uid",
    "payment_request_uid",
    "paymentRequestUid",
    "data.payment_request_uid",
    "transaction.payment_request_uid",
  ]);
  const moreInfo = pick(payload, [
    "transaction.more_info",
    "more_info",
    "moreInfo",
    "data.more_info",
  ]);
  // PayPlus puts the success/failure code right in the IPN body. "000" = paid.
  const statusCodeFromBody = pick(payload, [
    "transaction.status_code",
    "status_code",
    "data.status_code",
  ]);

  console.log("[payplus webhook] received", {
    transactionUid,
    paymentRequestUid,
    moreInfo,
    statusCodeFromBody,
  });

  if (!transactionUid && !paymentRequestUid) {
    console.warn("[payplus webhook] missing transaction id", { payload });
    return NextResponse.json({ ok: false, reason: "missing-transaction-id" });
  }

  // The IPN body itself carries status_code "000" for success. Use that as
  // the source of truth, then re-query PayPlus as an authenticity check
  // (forged IPN won't have a real transaction backing it).
  if (statusCodeFromBody !== "000") {
    console.warn("[payplus webhook] non-success status", { statusCodeFromBody });
    return NextResponse.json({
      ok: false,
      reason: "non-success-status",
      statusCode: statusCodeFromBody,
    });
  }

  let verified;
  try {
    verified = await verifyTransaction({ transactionUid, paymentRequestUid });
  } catch (e) {
    console.error("[payplus webhook] verify threw", e);
    return NextResponse.json({ ok: false, reason: "verify-threw" });
  }

  console.log("[payplus webhook] verified", {
    ok: verified.ok,
    statusCode: verified.statusCode,
    moreInfoFromVerify: verified.moreInfo,
  });

  if (!verified.ok) {
    return NextResponse.json({
      ok: false,
      reason: "verify-failed",
      statusCode: verified.statusCode,
    });
  }

  // Prefer the more_info from the verification response (PayPlus-issued)
  // over what the IPN body gave us (could be tampered with). Fall back to
  // the IPN body if verify didn't echo it.
  const trustedMoreInfo = verified.moreInfo ?? moreInfo;
  const target = parseMoreInfo(trustedMoreInfo);
  if (!target) {
    console.warn("[payplus webhook] unrecognized more_info", { trustedMoreInfo });
    return NextResponse.json({ ok: false, reason: "no-more-info" });
  }

  if (target.kind === "cart") {
    return handleCart(target.id, transactionUid);
  }
  return handleOrder(target.id, transactionUid);
}

// --- handlers ---

async function handleOrder(orderId: string, transactionUid: string | null) {
  const beforeOrder = await getOrder(orderId);
  if (!beforeOrder) {
    console.warn("[payplus webhook] order not found", { orderId });
    return NextResponse.json({ ok: false, reason: "order-not-found", orderId });
  }

  // Atomic claim: only the IPN invocation that flips paid_at gets the row
  // back. Concurrent invocations (PayPlus IPN retries fire ~60ms apart) get
  // null and short-circuit — no double Prodigi submission, no double email.
  const paidRow = await markOrderPaidIfUnpaid(orderId, transactionUid);
  if (!paidRow) {
    console.log("[payplus webhook] order already processed, skipping", { orderId });
    return NextResponse.json({ ok: true, orderId, alreadyProcessed: true });
  }

  const submission = await submitOrderForPrinting(orderId);

  {
    const productType: ProductType = isProductType(paidRow.product_type)
      ? paidRow.product_type
      : "sticker";
    const imageUrl = await signedImage(paidRow.print_image_url || paidRow.image_url);
    const a = paidRow.shipping_address;

    if (paidRow.email) {
      await sendOrderConfirmation({
        to: paidRow.email,
        orderId: paidRow.id,
        productType,
        size: paidRow.size_mm,
        quantity: paidRow.quantity,
        totalAgorot: paidRow.total_agorot,
        imageUrl,
        shippingName: a.name,
        shippingCity: a.city,
      });
    }

    await sendOwnerOrderNotification({
      orderId: paidRow.id,
      productType,
      size: paidRow.size_mm,
      quantity: paidRow.quantity,
      totalAgorot: paidRow.total_agorot,
      customerPhone: paidRow.phone_e164,
      customerEmail: paidRow.email,
      imageUrl,
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
    orderId,
    submission,
    firstPayment: true,
  });
}

async function handleCart(cartId: string, transactionUid: string | null) {
  const before = await getCartOrders(cartId);
  if (before.length === 0) {
    console.warn("[payplus webhook] cart not found", { cartId });
    return NextResponse.json({ ok: false, reason: "cart-not-found", cartId });
  }

  // Atomic claim: markCartPaid filters on `paid_at IS NULL`, so only the
  // first concurrent caller gets non-empty rows back. Subsequent IPN retries
  // (PayPlus fires ~60ms apart) get [] and short-circuit — no double
  // Prodigi submission, no double email.
  const justPaid = await markCartPaid(cartId, transactionUid);
  if (justPaid.length === 0) {
    console.log("[payplus webhook] cart already processed, skipping", { cartId });
    return NextResponse.json({ ok: true, cartId, alreadyProcessed: true });
  }

  const submission = await submitCartForPrinting(cartId);

  {
    const first = justPaid[0];
    const a = first.shipping_address;
    const totalAgorot = justPaid.reduce((n, r) => n + (r.total_agorot ?? 0), 0);
    const totalQty = justPaid.reduce((n, r) => n + r.quantity, 0);

    const productTypes = new Set(justPaid.map((r) => r.product_type));
    const cartProductType: ProductType | "mixed" =
      productTypes.size === 1 && isProductType(first.product_type)
        ? (first.product_type as ProductType)
        : "mixed";

    const imageUrl = await signedImage(first.print_image_url || first.image_url);

    if (first.email) {
      await sendOrderConfirmation({
        to: first.email,
        orderId: cartId,
        productType: cartProductType,
        size: justPaid.length === 1 ? justPaid[0].size_mm : "mixed",
        quantity: totalQty,
        totalAgorot,
        imageUrl,
        shippingName: a.name,
        shippingCity: a.city,
      });
    }

    await sendOwnerOrderNotification({
      orderId: cartId,
      productType: cartProductType,
      size:
        justPaid.length === 1
          ? justPaid[0].size_mm
          : `mixed (${justPaid.length} items)`,
      quantity: totalQty,
      totalAgorot,
      customerPhone: first.phone_e164,
      customerEmail: first.email,
      imageUrl,
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
    submission,
    firstPayment: true,
    rows: justPaid.length,
  });
}

// --- parsing helpers ---

function parseBody(
  raw: string,
  contentType: string | null,
): Record<string, unknown> {
  const ct = (contentType ?? "").toLowerCase();
  const trimmed = raw.trim();

  if (ct.includes("application/json") || trimmed.startsWith("{")) {
    try {
      const j = JSON.parse(trimmed);
      return typeof j === "object" && j !== null ? (j as Record<string, unknown>) : {};
    } catch {
      // fall through to form parsing
    }
  }

  // form-urlencoded (default for PayPlus IPN)
  const out: Record<string, string> = {};
  try {
    const params = new URLSearchParams(raw);
    for (const [k, v] of params.entries()) out[k] = v;
  } catch {
    // ignore
  }
  return out;
}

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

// Walk dot-paths (e.g. "transaction.uid") through nested objects.
function pick(obj: Record<string, unknown>, paths: string[]): string | null {
  for (const p of paths) {
    const parts = p.split(".");
    let cur: unknown = obj;
    for (const part of parts) {
      if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[part];
      } else {
        cur = undefined;
        break;
      }
    }
    const s = str(cur);
    if (s) return s;
  }
  return null;
}

function parseMoreInfo(
  v: string | null,
): { kind: "order" | "cart"; id: string } | null {
  if (!v) return null;
  const m = v.match(/^(order|cart):([0-9a-fA-F-]{8,})$/);
  if (!m) return null;
  return { kind: m[1] as "order" | "cart", id: m[2] };
}

async function signedImage(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await serverClient()
    .storage.from(STORAGE_BUCKET)
    .createSignedUrl(path, 7 * 24 * 60 * 60);
  return data?.signedUrl ?? null;
}
