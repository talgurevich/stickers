import { NextResponse } from "next/server";
import { markOrderShipped } from "@/lib/orders";
import { sendShippedNotification } from "@/lib/email";

export const runtime = "nodejs";

// Prodigi callback URL. Set the per-merchant or per-order URL in Prodigi's
// dashboard to:
//   https://www.wallaura.art/api/webhooks/prodigi?secret=<PRODIGI_WEBHOOK_SECRET>
// Prodigi's V4 docs don't surface a request-signing scheme, so we rely on
// the secret in the query string (same pattern we use for Green API).

type ProdigiCallback = {
  // Event type, e.g. "com.prodigi.order.status.stage.changed#Shipped"
  // or shipment-level changes.
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

function pickShipped(payload: ProdigiCallback): {
  orderId: string;
  trackingUrl: string | null;
} | null {
  const orderId =
    payload.data?.order?.id ?? payload.subject ?? "";
  if (!orderId.startsWith("ord_")) return null;

  // Order-level "Shipped" stage OR any shipment with status=Shipped.
  const stage = payload.data?.order?.status?.stage ?? "";
  const shipments = payload.data?.order?.shipments ?? [];
  const shipped = shipments.find(
    (s) => (s.status ?? "").toLowerCase() === "shipped",
  );
  const orderShipped = stage.toLowerCase() === "shipped";

  if (!shipped && !orderShipped) return null;

  return {
    orderId,
    trackingUrl: shipped?.tracking?.url ?? null,
  };
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

  const shipped = pickShipped(body);
  if (!shipped) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const result = await markOrderShipped({
    prodigiOrderId: shipped.orderId,
    trackingUrl: shipped.trackingUrl,
  });

  if (result.kind !== "marked" || !result.order) {
    return NextResponse.json({ ok: true, result });
  }

  // Idempotent: only fire the email on the first transition.
  if (!result.alreadyShipped && result.order.email) {
    await sendShippedNotification({
      to: result.order.email,
      orderId: result.order.id,
      trackingUrl: result.trackingUrl,
    });
  }

  return NextResponse.json({ ok: true, result });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
