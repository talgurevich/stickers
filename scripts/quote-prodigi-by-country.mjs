// Probe Prodigi /quotes for the full SKU × country × qty matrix used by
// lib/pricing.ts. Output drives the per-country shipping table for
// international orders. Re-run whenever Prodigi pricing or the supported
// country list changes.
//
// Usage:
//   node --env-file=.env.local scripts/quote-prodigi-by-country.mjs > scripts/prodigi-quotes-by-country.json

const KEY = process.env.PRODIGI_API_KEY;
const BASE = process.env.PRODIGI_BASE_URL ?? "https://api.prodigi.com/v4.0";
if (!KEY) {
  console.error("set PRODIGI_API_KEY");
  process.exit(1);
}

// MVP destination whitelist. Order matches lib/countries.ts so a re-run
// produces a deterministic dump.
const COUNTRIES = ["IL", "US", "GB", "DE", "FR", "IT", "ES", "CA", "AU", "TH"];

// Same SKU set as the per-country pricing table needs. Single-piece SKUs
// only — multi-pack magnets (MAG-4-*, MAG-9-*) are excluded by design.
const SKUS = [
  "M-STI-3X4", // sticker small
  "M-STI-5_5X5_5", // sticker medium
  "M-STI-8_5X8_5", // sticker large
  "MAG-1-10X10", // magnet small
  "MAG-1-15X15", // magnet large
  "GLOBAL-TATT-S", // tattoo S
  "GLOBAL-TATT-M", // tattoo M
  "GLOBAL-TATT-L", // tattoo L
];

const QTY_BUCKETS = [1, 2, 3, 5, 10, 20, 50];

async function quote(countryCode, sku, copies) {
  const res = await fetch(`${BASE.replace(/\/$/, "")}/quotes`, {
    method: "POST",
    headers: { "X-API-Key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      destinationCountryCode: countryCode,
      items: [{ sku, copies, assets: [{ printArea: "default" }] }],
    }),
  });
  return { status: res.status, body: await res.json() };
}

const matrix = {};
for (const country of COUNTRIES) {
  matrix[country] = {};
  for (const sku of SKUS) {
    matrix[country][sku] = {};
    for (const copies of QTY_BUCKETS) {
      process.stderr.write(`probing ${country} · ${sku} × ${copies}...\n`);
      const r = await quote(country, sku, copies);
      if (r.status !== 200) {
        matrix[country][sku][copies] = { error: r.body };
        continue;
      }
      const quotes = (r.body.quotes ?? []).map((q) => ({
        method: q.shipmentMethod,
        itemsUsd: parseFloat(q.costSummary?.items?.amount ?? "0"),
        shippingUsd: parseFloat(q.costSummary?.shipping?.amount ?? "0"),
        totalUsd: parseFloat(q.costSummary?.totalCost?.amount ?? "0"),
      }));
      matrix[country][sku][copies] = { copies, quotes };
    }
  }
}

console.log(JSON.stringify(matrix, null, 2));
