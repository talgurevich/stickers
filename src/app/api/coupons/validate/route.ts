import { NextResponse } from "next/server";
import { validateCoupon } from "@/lib/coupons";

export const runtime = "nodejs";

// Preview-only validation. The actual increment happens at checkout via
// redeemCoupon() — this route never decrements/increments anything.
export async function POST(req: Request) {
  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  if (!body.code) {
    return NextResponse.json({ ok: false, reason: "missing-code" }, { status: 400 });
  }
  const result = await validateCoupon(body.code);
  return NextResponse.json(result);
}
