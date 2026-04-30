import { NextResponse } from "next/server";
import { generatePaymentLink, PayPlusError } from "@/lib/payplus";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function POST() {
  const appUrl = env.appUrl();
  try {
    const result = await generatePaymentLink({
      amount: 1,
      currencyCode: "ILS",
      moreInfo: "step-1-domain-proof",
      refUrlSuccess: `${appUrl}/payment/success`,
      refUrlFailure: `${appUrl}/payment/failure`,
      refUrlCallback: `${appUrl}/api/webhooks/payplus`,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof PayPlusError) {
      return NextResponse.json(
        { error: e.message, raw: e.raw },
        { status: 502 },
      );
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
