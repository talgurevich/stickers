import { NextResponse } from "next/server";
import { markOrderShipped } from "@/lib/orders";
import { sendShippedNotification } from "@/lib/email";
import { serverClient } from "@/lib/supabase";

export const runtime = "nodejs";

// Throw-away endpoint: simulate Prodigi marking an order shipped, so we can
// validate the email + DB state without waiting for actual fulfillment.
//
// POST /api/admin/simulate-shipped { orderId | prodigiOrderId, trackingUrl? }
export async function POST(req: Request) {
  let body: {
    orderId?: string;
    prodigiOrderId?: string;
    trackingUrl?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  // Resolve to a Prodigi id — accept either form for convenience.
  let prodigiId = body.prodigiOrderId ?? "";
  if (!prodigiId && body.orderId) {
    const { data } = await serverClient()
      .from("orders")
      .select("printful_order_id")
      .eq("id", body.orderId)
      .maybeSingle();
    prodigiId = (data?.printful_order_id as string | null) ?? "";
  }
  if (!prodigiId) {
    return NextResponse.json(
      { error: "missing-prodigiOrderId-or-orderId-with-fulfillment" },
      { status: 400 },
    );
  }

  const result = await markOrderShipped({
    prodigiOrderId: prodigiId,
    trackingUrl: body.trackingUrl ?? "https://example.com/track/test",
  });

  let email: unknown = null;
  if (result.kind === "marked" && !result.alreadyShipped && result.order?.email) {
    email = await sendShippedNotification({
      to: result.order.email,
      orderId: result.order.id,
      trackingUrl: result.trackingUrl,
    });
  }

  return NextResponse.json({ result, email });
}
