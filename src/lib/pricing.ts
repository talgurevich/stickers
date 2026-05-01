// Sticker pricing — derived from real Prodigi /quotes for IL shipping on
// 2026-04-30 (full dump in scripts/prodigi-quotes.json). Re-run
// scripts/quote-prodigi.mjs to refresh whenever Prodigi changes pricing.
//
// Formula:
//   product cost (USD)  = Prodigi unit cost × quantity
//   shipping cost (USD) = Prodigi Budget shipping (flat per shipment)
//   product retail (ILS) = product cost × MARKUP × USD_TO_ILS
//   shipping (ILS)       = shipping cost × USD_TO_ILS  (passed through at cost)
//   total (ILS)          = product retail + shipping + handling
//
// We deliberately removed the old artificial 10/20% quantity discounts —
// shipping is flat, so the per-unit price drops naturally as quantity grows
// (a single Small is ~₪35; ten Smalls is ~₪9 each).

import type { StickerSize } from "./prodigi-catalog";

// Prodigi production cost per single sticker, USD (from /quotes).
const PRODIGI_UNIT_USD: Record<StickerSize, number | null> = {
  small: 1.09,
  medium: 3.39,
  large: 6.11,
  xlarge: null, // not in MVP picker; re-run quote when enabling
};

// Prodigi Budget shipping to IL, USD (flat per shipment).
const PRODIGI_SHIPPING_USD: Record<StickerSize, number | null> = {
  small: 7.47,
  medium: 7.47,
  large: 9.44,
  xlarge: null,
};

// Frozen FX. Bank of Israel reference rate fluctuates daily; pinning a
// slightly conservative value keeps prices stable and absorbs small swings.
// Revisit if USD/ILS moves >10% off this number.
const USD_TO_ILS = 3.7;

// Retail markup applied to item cost only. Shipping is passed through
// without markup — keeps the line item honest and the total approachable.
const MARKUP = 1.6;

// Marketing-level bulk discount on the markup. Prodigi itself charges flat
// per-copy at production (no bulk discount from them), so this comes out of
// our margin: it signals "buy more, save more" and keeps the per-unit price
// from looking insulting at qty=5+. Applied to the marked-up product cost,
// not to shipping or handling. Tweak freely — these are pure pricing knobs.
function bulkDiscountFor(quantity: number): number {
  if (quantity >= 20) return 0.3; // 30% off items
  if (quantity >= 10) return 0.2; // 20%
  if (quantity >= 5) return 0.1; // 10%
  return 0;
}

// Per-order handling fee (agorot) — buffer for FX drift, payment processor
// fees once PayPlus is enabled, and small operational overhead.
const HANDLING_AGOROT = 300; // ₪3

export type PriceBreakdown = {
  productAgorot: number;
  shippingAgorot: number;
  totalAgorot: number;
  /** Per-sticker delivered price for display ("מחיר ליחידה"). */
  perUnitAgorot: number;
  /** Bulk discount applied (0..0.3); 0 means no discount. */
  bulkDiscount: number;
  /** What product would have cost without bulk discount, for "before" display. */
  productBeforeDiscountAgorot: number;
};

export function priceFor(
  size: StickerSize,
  quantity: number,
): PriceBreakdown {
  if (quantity < 1 || quantity > 50) {
    throw new Error(`quantity ${quantity} outside 1-50`);
  }
  const unitUsd = PRODIGI_UNIT_USD[size];
  const shippingUsd = PRODIGI_SHIPPING_USD[size];
  if (unitUsd === null || shippingUsd === null) {
    throw new Error(`no pricing data for size ${size}`);
  }

  // Compute in agorot directly to avoid floating-point drift.
  const productBeforeDiscountAgorot = Math.round(
    unitUsd * quantity * MARKUP * USD_TO_ILS * 100,
  );
  const bulkDiscount = bulkDiscountFor(quantity);
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

export type CartPriceItem = {
  size: StickerSize;
  quantity: number;
};

export type CartPriceLine = {
  size: StickerSize;
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

// One shipment regardless of how many designs — Prodigi packs everything
// into a single parcel, so we charge shipping once. The largest item's
// shipping rate dominates (the parcel grows with the biggest sticker), so
// we use the max across items rather than summing per-item rates.
//
// Bulk discount is applied per-line on its own quantity, not on the cart
// total. (Otherwise mixing 1 small + 4 large would leak a discount tier;
// users who want the 5+ price should buy 5 of the same design.)
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
    const unitUsd = PRODIGI_UNIT_USD[it.size];
    const shippingUsd = PRODIGI_SHIPPING_USD[it.size];
    if (unitUsd === null || shippingUsd === null) {
      throw new Error(`no pricing data for size ${it.size}`);
    }
    const lineBeforeDiscount = Math.round(
      unitUsd * it.quantity * MARKUP * USD_TO_ILS * 100,
    );
    const lineDiscount = bulkDiscountFor(it.quantity);
    const lineProductAgorot = Math.round(lineBeforeDiscount * (1 - lineDiscount));
    productAgorot += lineProductAgorot;
    productBeforeDiscountAgorot += lineBeforeDiscount;
    if (shippingUsd > shippingUsdMax) shippingUsdMax = shippingUsd;
    lines.push({
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
