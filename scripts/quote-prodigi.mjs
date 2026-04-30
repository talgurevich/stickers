// One-time discovery: hit Prodigi /quotes for every (sticker SKU × qty bucket)
// shipping to Israel and dump the cost table. Output drives lib/pricing.ts.
//
// Usage (from project root):
//   PRODIGI_API_KEY=... PRODIGI_BASE_URL=... node scripts/quote-prodigi.mjs
// or
//   node --env-file=.env.local scripts/quote-prodigi.mjs

const KEY = process.env.PRODIGI_API_KEY;
const BASE = process.env.PRODIGI_BASE_URL ?? "https://api.prodigi.com/v4.0";
if (!KEY) {
  console.error("set PRODIGI_API_KEY");
  process.exit(1);
}

const SKUS = ["M-STI-3X4", "M-STI-5_5X5_5", "M-STI-8_5X8_5"];
const QTY_BUCKETS = [1, 2, 3, 5, 10, 20, 50];
// /quotes accepts assets with only printArea — no URL needed (it doesn't
// actually fetch the image, just validates schema).
async function quote(sku, copies) {
  const res = await fetch(`${BASE.replace(/\/$/, "")}/quotes`, {
    method: "POST",
    headers: { "X-API-Key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      destinationCountryCode: "IL",
      items: [
        { sku, copies, assets: [{ printArea: "default" }] },
      ],
    }),
  });
  return { status: res.status, body: await res.json() };
}

const matrix = {};
for (const sku of SKUS) {
  matrix[sku] = {};
  for (const copies of QTY_BUCKETS) {
    process.stderr.write(`probing ${sku} × ${copies}...\n`);
    const r = await quote(sku, copies);
    if (r.status !== 200) {
      matrix[sku][copies] = { error: r.body };
      continue;
    }
    // Each quote object: { shipmentMethod, costSummary: { totalCost, items, shipping, fees } }
    const quotes = (r.body.quotes ?? []).map((q) => ({
      method: q.shipmentMethod,
      itemsUsd: parseFloat(q.costSummary?.items?.amount ?? "0"),
      shippingUsd: parseFloat(q.costSummary?.shipping?.amount ?? "0"),
      totalUsd: parseFloat(q.costSummary?.totalCost?.amount ?? "0"),
    }));
    matrix[sku][copies] = { copies, quotes };
  }
}

console.log(JSON.stringify(matrix, null, 2));
