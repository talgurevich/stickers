// Multi-product pricing — derived from real Prodigi /quotes for IL shipping.
// Sticker rates verified 2026-04-30 (scripts/prodigi-quotes.json),
// magnet + tattoo rates verified 2026-05-02 (scripts/prodigi-quotes-multi.json).
// Re-run scripts/quote-prodigi*.mjs whenever Prodigi pricing changes.
//
// Formula (per line):
//   product retail (ILS) = unit_usd × qty × MARKUP[product] × USD_TO_ILS × (1 - bulk_discount)
//   shipping (ILS)       = max(shipping_usd) × USD_TO_ILS  // one shipment per cart
//   total (ILS)          = product retail + shipping + handling
//
// Shipping is at cost (no markup) — keeps the line item honest. We assume
// Prodigi consolidates a multi-product cart into one parcel; verify this
// once we have a real mixed order in flight.

import type {
  ProductType,
  StickerSize,
  MagnetSize,
  TattooSize,
} from "./prodigi-catalog";

// --- Per-product Prodigi cost tables (USD) --------------------------------

const STICKER_UNIT_USD: Record<StickerSize, number | null> = {
  small: 1.09,
  medium: 3.39,
  large: 6.11,
  xlarge: null,
};
const STICKER_SHIPPING_USD: Record<StickerSize, number | null> = {
  small: 7.47,
  medium: 7.47,
  large: 9.44,
  xlarge: null,
};

const MAGNET_UNIT_USD: Record<MagnetSize, number> = {
  small: 5.43,
  large: 8.15,
};
const MAGNET_SHIPPING_USD: Record<MagnetSize, number> = {
  small: 7.47,
  large: 7.47,
};

const TATTOO_UNIT_USD: Record<TattooSize, number> = {
  s: 4.01,
  m: 8.08,
  l: 12.15,
};
const TATTOO_SHIPPING_USD: Record<TattooSize, number> = {
  s: 7.47,
  m: 7.47,
  l: 7.47,
};

// --- Global constants -----------------------------------------------------

// Frozen FX. Bank of Israel reference rate fluctuates daily; pinning a
// slightly conservative value keeps prices stable. Revisit if USD/ILS moves
// >10% off this number.
const USD_TO_ILS = 3.7;

// Per-product retail markup applied to item cost only. Shipping is passed
// through without markup. Magnets and tattoos have higher base costs than
// stickers, so a 1.6× markup would price them out of the market — we
// compress markup on the more expensive products to keep retail reasonable.
const MARKUP_BY_PRODUCT: Record<ProductType, number> = {
  sticker: 1.6,
  magnet: 1.5,
  tattoo: 1.55,
};

// Per-product handling fee in agorot. Buffers FX drift, PayPlus processing
// fees, and small operational overhead.
const HANDLING_AGOROT = 300; // ₪3, all products

// --- Bulk discount tiers, per product -------------------------------------
//
// Sticker tiers (10/20/30) are aggressive because base cost is tiny and the
// bulk discount creates the perception of value at high qty.
//
// Magnets are mid-priced; buyers tend to order for fridges/events in small
// batches (2–6) rather than 20+. Earlier first tier (qty 3) rewards the
// 1→3 upsell, lower cap (25%) because base cost leaves less margin to give.
//
// Tattoos are the bulk product — birthday parties, events. Deeper tiers and
// a higher cap (35%) push the 10+ and 20+ thresholds.

function bulkDiscountForSticker(qty: number): number {
  if (qty >= 20) return 0.3;
  if (qty >= 10) return 0.2;
  if (qty >= 5) return 0.1;
  return 0;
}

function bulkDiscountForMagnet(qty: number): number {
  if (qty >= 20) return 0.25;
  if (qty >= 10) return 0.18;
  if (qty >= 5) return 0.12;
  if (qty >= 3) return 0.05;
  return 0;
}

function bulkDiscountForTattoo(qty: number): number {
  if (qty >= 20) return 0.35;
  if (qty >= 10) return 0.25;
  if (qty >= 5) return 0.15;
  return 0;
}

export function bulkDiscountFor(type: ProductType, qty: number): number {
  switch (type) {
    case "sticker":
      return bulkDiscountForSticker(qty);
    case "magnet":
      return bulkDiscountForMagnet(qty);
    case "tattoo":
      return bulkDiscountForTattoo(qty);
  }
}

// --- Per-product cost lookup ----------------------------------------------

function unitUsdFor(type: ProductType, size: string): number | null {
  switch (type) {
    case "sticker":
      return STICKER_UNIT_USD[size as StickerSize] ?? null;
    case "magnet":
      return MAGNET_UNIT_USD[size as MagnetSize] ?? null;
    case "tattoo":
      return TATTOO_UNIT_USD[size as TattooSize] ?? null;
  }
}

function shippingUsdFor(type: ProductType, size: string): number | null {
  switch (type) {
    case "sticker":
      return STICKER_SHIPPING_USD[size as StickerSize] ?? null;
    case "magnet":
      return MAGNET_SHIPPING_USD[size as MagnetSize] ?? null;
    case "tattoo":
      return TATTOO_SHIPPING_USD[size as TattooSize] ?? null;
  }
}

// --- Single-line price (one product, one size, one quantity) --------------

export type PriceBreakdown = {
  productAgorot: number;
  shippingAgorot: number;
  totalAgorot: number;
  /** Per-piece delivered price for display. */
  perUnitAgorot: number;
  /** Bulk discount applied (0..0.35); 0 means none. */
  bulkDiscount: number;
  /** What product would have cost without bulk discount (for "before" display). */
  productBeforeDiscountAgorot: number;
};

export function priceFor(
  productType: ProductType,
  size: string,
  quantity: number,
): PriceBreakdown {
  if (quantity < 1 || quantity > 50) {
    throw new Error(`quantity ${quantity} outside 1-50`);
  }
  const unitUsd = unitUsdFor(productType, size);
  const shippingUsd = shippingUsdFor(productType, size);
  if (unitUsd === null || shippingUsd === null) {
    throw new Error(`no pricing data for ${productType}/${size}`);
  }
  const markup = MARKUP_BY_PRODUCT[productType];

  const productBeforeDiscountAgorot = Math.round(
    unitUsd * quantity * markup * USD_TO_ILS * 100,
  );
  const bulkDiscount = bulkDiscountFor(productType, quantity);
  const productAgorot = Math.round(
    productBeforeDiscountAgorot * (1 - bulkDiscount),
  );
  const shippingAgorot = Math.round(shippingUsd * USD_TO_ILS * 100);
  const totalAgorot = productAgorot + shippingAgorot + HANDLING_AGOROT;
  const perUnitAgorot = Math.round(totalAgorot / quantity);

  return {
    productAgorot,
    shippingAgorot,
    totalAgorot,
    perUnitAgorot,
    bulkDiscount,
    productBeforeDiscountAgorot,
  };
}

// --- Cart price (mixed products, single shipment) -------------------------

export type CartPriceItem = {
  productType: ProductType;
  size: string;
  quantity: number;
};

export type CartPriceLine = {
  productType: ProductType;
  size: string;
  quantity: number;
  productAgorot: number;
  productBeforeDiscountAgorot: number;
  bulkDiscount: number;
};

export type CartPriceBreakdown = {
  lines: CartPriceLine[];
  productAgorot: number;
  productBeforeDiscountAgorot: number;
  shippingAgorot: number;
  handlingAgorot: number;
  totalAgorot: number;
};

// One shipment for the whole cart — Prodigi consolidates into a single
// parcel. The biggest item dictates the parcel size, so shipping is the
// MAX shipping rate across all lines (not the sum). If we discover Prodigi
// splits mixed-product carts into separate shipments, this becomes a sum
// (or a per-product-type max + sum across types). Verify with a real
// mixed order.
//
// Bulk discount is applied per-line on its own (productType, qty), not on
// cart totals — buying 1 small sticker + 4 small magnets gives no discount
// on either, which is correct.
export function priceForCart(items: CartPriceItem[]): CartPriceBreakdown {
  if (items.length === 0) {
    throw new Error("cart is empty");
  }
  const lines: CartPriceLine[] = [];
  let productAgorot = 0;
  let productBeforeDiscountAgorot = 0;
  let shippingUsdMax = 0;

  for (const it of items) {
    if (it.quantity < 1 || it.quantity > 50) {
      throw new Error(`quantity ${it.quantity} outside 1-50`);
    }
    const unitUsd = unitUsdFor(it.productType, it.size);
    const shippingUsd = shippingUsdFor(it.productType, it.size);
    if (unitUsd === null || shippingUsd === null) {
      throw new Error(`no pricing data for ${it.productType}/${it.size}`);
    }
    const markup = MARKUP_BY_PRODUCT[it.productType];
    const lineBeforeDiscount = Math.round(
      unitUsd * it.quantity * markup * USD_TO_ILS * 100,
    );
    const lineDiscount = bulkDiscountFor(it.productType, it.quantity);
    const lineProductAgorot = Math.round(
      lineBeforeDiscount * (1 - lineDiscount),
    );
    productAgorot += lineProductAgorot;
    productBeforeDiscountAgorot += lineBeforeDiscount;
    if (shippingUsd > shippingUsdMax) shippingUsdMax = shippingUsd;
    lines.push({
      productType: it.productType,
      size: it.size,
      quantity: it.quantity,
      productAgorot: lineProductAgorot,
      productBeforeDiscountAgorot: lineBeforeDiscount,
      bulkDiscount: lineDiscount,
    });
  }
  const shippingAgorot = Math.round(shippingUsdMax * USD_TO_ILS * 100);
  const handlingAgorot = HANDLING_AGOROT;
  const totalAgorot = productAgorot + shippingAgorot + handlingAgorot;
  return {
    lines,
    productAgorot,
    productBeforeDiscountAgorot,
    shippingAgorot,
    handlingAgorot,
    totalAgorot,
  };
}

export function formatIls(agorot: number): string {
  return `₪${(agorot / 100).toFixed(2).replace(/\.00$/, "")}`;
}
