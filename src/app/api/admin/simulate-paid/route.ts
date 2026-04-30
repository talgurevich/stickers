import { NextResponse } from "next/server";
import { markOrderPaid, submitOrderToPrintful } from "@/lib/orders";

export const runtime = "nodejs";

// Throw-away admin endpoint: mark an order paid + submit to Printful, without
// going through PayPlus. Used to validate the post-payment pipeline while we
// wait for PayPlus support to provision the new payment page.
//
// POST /api/admin/simulate-paid  body: { orderId, transactionId? }
export async function POST(req: Request) {
  let body: { orderId?: string; transactionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  if (!body.orderId) {
    return NextResponse.json({ error: "missing-orderId" }, { status: 400 });
  }

  const paid = await markOrderPaid(body.orderId, body.transactionId ?? "simulated");
  if (!paid) {
    return NextResponse.json({ error: "order-not-found" }, { status: 404 });
  }

  const submitted = await submitOrderToPrintful(body.orderId);
  return NextResponse.json({ paid: true, submitted });
}
