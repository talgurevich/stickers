import { NextResponse } from "next/server";
import { getSession } from "@/lib/sessions";
import { priceFor } from "@/lib/pricing";
import { generatePaymentLink, PayPlusError } from "@/lib/payplus";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const session = getSession(id);
  if (!session) {
    return NextResponse.json({ error: "session-not-found" }, { status: 404 });
  }
  const { sizeMm, cut, quantity, address } = session.config;
  if (!sizeMm || !cut || !quantity) {
    return NextResponse.json({ error: "config-incomplete" }, { status: 400 });
  }
  if (!address?.name || !address.street || !address.city || !address.zip) {
    return NextResponse.json({ error: "address-incomplete" }, { status: 400 });
  }
  if (!session.imageUrl) {
    return NextResponse.json({ error: "image-missing" }, { status: 400 });
  }

  const price = priceFor(sizeMm, cut, quantity);
  const appUrl = env.appUrl();

  try {
    const result = await generatePaymentLink({
      amount: price.totalAgorot / 100, // PayPlus expects ILS, not agorot
      currencyCode: "ILS",
      moreInfo: `session:${session.id}`,
      refUrlSuccess: `${appUrl}/payment/success?session=${session.id}`,
      refUrlFailure: `${appUrl}/payment/failure?session=${session.id}`,
      refUrlCallback: `${appUrl}/api/webhooks/payplus`,
    });
    return NextResponse.json({
      paymentPageLink: result.paymentPageLink,
      pageRequestUid: result.pageRequestUid,
      breakdown: price,
    });
  } catch (e) {
    if (e instanceof PayPlusError) {
      return NextResponse.json(
        { error: e.message, raw: e.raw },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
