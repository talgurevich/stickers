import { NextResponse } from "next/server";
import { sendOrderConfirmation } from "@/lib/email";

export const runtime = "nodejs";

// Sanity probe: send a fake order confirmation to whichever address you
// provide. Useful while validating Resend setup + sender domain.
//
// GET /api/admin/email-test?to=tal.gurevich2@gmail.com
export async function GET(req: Request) {
  const url = new URL(req.url);
  const to = url.searchParams.get("to");
  if (!to) {
    return NextResponse.json(
      { error: "missing-?to=address" },
      { status: 400 },
    );
  }
  const result = await sendOrderConfirmation({
    to,
    orderId: "test-order-id-0001",
    items: [
      { productType: "sticker", size: "medium", quantity: 3, imageUrl: null },
      { productType: "magnet", size: "small", quantity: 1, imageUrl: null },
    ],
    totalAgorot: 9000,
    shippingName: "Test Buyer",
    shippingCity: "Tel Aviv",
  });
  return NextResponse.json(result);
}
