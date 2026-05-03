import { NextResponse } from "next/server";
import {
  getOrdersByProdigi,
  markOrderShipped,
  markOrdersStageIfPriorThan,
} from "@/lib/orders";
import {
  sendInProductionNotification,
  sendOwnerStatusUpdate,
  sendShippedNotification,
} from "@/lib/email";
import { isProductType, type ProductType } from "@/lib/prodigi-catalog";
import { serverClient, STORAGE_BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";

// Prodigi callback URL. Set the per-merchant or per-order URL in Prodigi's
// dashboard to:
//   https://www.wallaura.art/api/webhooks/prodigi?secret=<PRODIGI_WEBHOOK_SECRET>
// Prodigi's V4 docs don't surface a request-signing scheme, so we rely on
// the secret in the query string (same pattern we use for Green API).

type ProdigiCallback = {
  type?: string;
  subject?: string;
  data?: {
    order?: {
      id?: string;
      status?: { stage?: string };
      shipments?: Array<{
        status?: string;
        tracking?: { url?: string | null; number?: string | null } | null;
      }>;
    };
  };
};

// Statuses we treat as "InProgress or beyond" — used to skip InProgress
// emails if the order has already moved past that stage.
const STAGES_AT_OR_AFTER_PRODUCTION = ["InProgress", "Shipped", "Complete"];

function pickShipped(payload: ProdigiCallback): {
  orderId: string;
  trackingUrl: string | null;
} | null {
  const orderId = payload.data?.order?.id ?? payload.subject ?? "";
  if (!orderId.startsWith("ord_")) return null;
  const stage = payload.data?.order?.status?.stage ?? "";
  const shipments = payload.data?.order?.shipments ?? [];
  const shipped = shipments.find(
    (s) => (s.status ?? "").toLowerCase() === "shipped",
  );
  const orderShipped = stage.toLowerCase() === "shipped";
  if (!shipped && !orderShipped) return null;
  return { orderId, trackingUrl: shipped?.tracking?.url ?? null };
}

function pickInProduction(payload: ProdigiCallback): { orderId: string } | null {
  const orderId = payload.data?.order?.id ?? payload.subject ?? "";
  if (!orderId.startsWith("ord_")) return null;
  const stage = (payload.data?.order?.status?.stage ?? "").toLowerCase();
  // Prodigi uses "InProgress" for production stage.
  if (stage !== "inprogress" && stage !== "in_progress") return null;
  return { orderId };
}

async function signedImage(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await serverClient()
    .storage.from(STORAGE_BUCKET)
    .createSignedUrl(path, 7 * 24 * 60 * 60);
  return data?.signedUrl ?? null;
}

export async function POST(req: Request) {
  const expected = process.env.PRODIGI_WEBHOOK_SECRET;
  if (expected) {
    const provided = new URL(req.url).searchParams.get("secret");
    if (provided !== expected) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let body: ProdigiCallback;
  try {
    body = (await req.json()) as ProdigiCallback;
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  console.log("[prodigi webhook]", {
    type: body.type,
    subject: body.subject,
    stage: body.data?.order?.status?.stage,
  });

  // Shipped (terminal status) takes precedence: a single payload can carry
  // both "stage=Shipped" and a shipped shipment, and we want the customer
  // to get the tracking email rather than the production-start one.
  const shipped = pickShipped(body);
  if (shipped) {
    return handleShipped(shipped);
  }

  const inProd = pickInProduction(body);
  if (inProd) {
    return handleInProduction(inProd);
  }

  return NextResponse.json({ ok: true, ignored: true });
}

async function handleShipped(args: {
  orderId: string;
  trackingUrl: string | null;
}) {
  const result = await markOrderShipped({
    prodigiOrderId: args.orderId,
    trackingUrl: args.trackingUrl,
  });

  if (result.kind !== "marked" || !result.order) {
    return NextResponse.json({ ok: true, result });
  }

  if (!result.alreadyShipped) {
    if (result.order.email) {
      await sendShippedNotification({
        to: result.order.email,
        orderId: result.order.id,
        trackingUrl: result.trackingUrl,
      });
    }
    await sendOwnerStatusUpdate({
      orderId: result.order.id,
      prodigiOrderId: args.orderId,
      stage: "Shipped",
      trackingUrl: result.trackingUrl,
      customerEmail: result.order.email,
    });
  }

  return NextResponse.json({ ok: true, result });
}

async function handleInProduction(args: { orderId: string }) {
  // Atomic stage bump — only rows that weren't already at/past production
  // come back. Concurrent webhook deliveries see [] and skip emails.
  const transitioned = await markOrdersStageIfPriorThan({
    prodigiOrderId: args.orderId,
    newStage: "InProgress",
    skipIfStatusIn: STAGES_AT_OR_AFTER_PRODUCTION,
  });

  if (transitioned.length === 0) {
    return NextResponse.json({ ok: true, alreadyAtStage: true });
  }

  const all = await getOrdersByProdigi(args.orderId);
  if (all.length === 0) {
    return NextResponse.json({ ok: true, ignored: true, reason: "no-rows" });
  }

  const first = all[0];
  const items = await Promise.all(
    all.map(async (r) => ({
      productType: isProductType(r.product_type)
        ? (r.product_type as ProductType)
        : ("sticker" as ProductType),
      size: r.size_mm,
      quantity: r.quantity,
      imageUrl: await signedImage(r.print_image_url || r.image_url),
    })),
  );

  const orderRef = first.cart_id ?? first.id;

  if (first.email) {
    await sendInProductionNotification({
      to: first.email,
      orderId: orderRef,
      items,
    });
  }
  await sendOwnerStatusUpdate({
    orderId: orderRef,
    prodigiOrderId: args.orderId,
    stage: "InProgress",
    customerEmail: first.email,
  });

  return NextResponse.json({ ok: true, transitioned: transitioned.length });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
