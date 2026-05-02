// Probe Prodigi /quotes for the new product lines (magnets + temporary
// tattoos) shipping to Israel. Mirrors quote-prodigi.mjs but covers SKUs
// added 2026-05-02 from the Prodigi public catalogue.
//
// Usage:
//   node --env-file=.env.local scripts/quote-prodigi-multi.mjs > scripts/prodigi-quotes-multi.json

const KEY = process.env.PRODIGI_API_KEY;
const BASE = process.env.PRODIGI_BASE_URL ?? "https://api.prodigi.com/v4.0";
if (!KEY) {
  console.error("set PRODIGI_API_KEY");
  process.exit(1);
}

// Single-piece magnets only (MAG-4-*/MAG-9-* are multi-packs and would
// distort the qty=N → N pieces invariant). Tattoos S/M/L for the MVP
// picker; XL/XXL exist but skip until demand proves out.
const SKUS = [
  "MAG-1-10X10",
  "MAG-1-15X15",
  "GLOBAL-TATT-S",
  "GLOBAL-TATT-M",
  "GLOBAL-TATT-L",
];
const QTY_BUCKETS = [1, 2, 3, 5, 10, 20, 50];

async function quote(sku, copies) {
  const res = await fetch(`${BASE.replace(/\/$/, "")}/quotes`, {
    method: "POST",
    headers: { "X-API-Key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      destinationCountryCode: "IL",
      items: [{ sku, copies, assets: [{ printArea: "default" }] }],
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
