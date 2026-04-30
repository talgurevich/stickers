import { NextResponse } from "next/server";
import { quote, ProdigiError } from "@/lib/prodigi";

export const runtime = "nodejs";

// Smoke test: hit Prodigi's quotes endpoint with a known sticker SKU and
// destination IL. If we get back a quote, auth + connectivity + IL shipping
// are all good. Once we pin real sticker SKUs, this probe gets more useful.
//
// GET /api/admin/prodigi-state?sku=<sku>&country=IL
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sku = url.searchParams.get("sku") ?? "GLOBAL-CFPM-16X20"; // arbitrary placeholder
  const country = url.searchParams.get("country") ?? "IL";
  try {
    const r = await quote({
      destinationCountryCode: country,
      items: [{ sku, copies: 1 }],
    });
    return NextResponse.json({
      ok: true,
      sku,
      country,
      quotes: r.quotes.map((q) => ({
        method: q.shippingMethod,
        total: `${q.costSummary.totalCost.amount} ${q.costSummary.totalCost.currency}`,
      })),
    });
  } catch (e) {
    if (e instanceof ProdigiError) {
      return NextResponse.json(
        { error: e.message, status: e.status, raw: e.raw },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
