// Multi-product, multi-country pricing — derived from real Prodigi /quotes.
// Sticker rates verified 2026-04-30 (scripts/prodigi-quotes.json), magnet +
// tattoo rates verified 2026-05-02 (scripts/prodigi-quotes-multi.json), and
// per-country shipping verified 2026-05-02
// (scripts/prodigi-quotes-by-country.json). Re-run scripts/quote-prodigi*.mjs
// whenever Prodigi pricing or the supported country list changes.
//
// Formula (per line):
//   product retail (ILS) = unit_usd × qty × MARKUP[product] × USD_TO_ILS × (1 - bulk_discount)
//   shipping (ILS)       = max(shipping_usd[country, sku]) × USD_TO_ILS  // one shipment per cart
//   total (ILS)          = product retail + shipping + handling
//
// Shipping is at cost (no markup) — keeps the line item honest. We assume
// Prodigi consolidates a multi-product cart into one parcel; verify this
// once we have a real mixed order in flight.

import {
  variantFor,
  type ProductType,
  type StickerSize,
  type MagnetSize,
  type TattooSize,
} from "./prodigi-catalog";
import type { CountryCode } from "./countries";

// --- Per-product Prodigi item-cost tables (USD) --------------------------
// Item cost doesn't change by destination — only shipping does.

const STICKER_UNIT_USD: Record<StickerSize, number | null> = {
  small: 1.09,
  medium: 3.39,
  large: 6.11,
  xlarge: null,
};

const MAGNET_UNIT_USD: Record<MagnetSize, number> = {
  small: 5.43,
  large: 8.15,
};

const TATTOO_UNIT_USD: Record<TattooSize, number> = {
  s: 4.01,
  m: 8.08,
  l: 12.15,
};

// --- Per-country shipping (USD), keyed by SKU ----------------------------
// Built from scripts/prodigi-quotes-by-country.json (qty=1 row; shipping is
// flat per shipment so qty doesn't change it). We pick the cheapest method
// that's available for ALL our SKUs in that country — for the US that's
// "Standard" because Prodigi doesn't offer Budget there.

export const SHIPPING_METHOD_BY_COUNTRY: Record<CountryCode, "Budget" | "Standard"> = {
  IL: "Budget",
  US: "Standard",
  GB: "Budget",
  DE: "Budget",
  FR: "Budget",
  IT: "Budget",
  ES: "Budget",
  CA: "Budget",
  AU: "Budget",
  TH: "Budget",
};

const SHIPPING_USD_BY_COUNTRY_SKU: Record<CountryCode, Record<string, number>> = {
  IL: {
    "M-STI-3X4": 7.47,
    "M-STI-5_5X5_5": 7.47,
    "M-STI-8_5X8_5": 9.44,
    "MAG-1-10X10": 7.47,
    "MAG-1-15X15": 7.47,
    "GLOBAL-TATT-S": 7.47,
    "GLOBAL-TATT-M": 7.47,
    "GLOBAL-TATT-L": 7.47,
  },
  US: {
    "M-STI-3X4": 31.28,
    "M-STI-5_5X5_5": 31.28,
    "M-STI-8_5X8_5": 32.71,
    "MAG-1-10X10": 31.28,
    "MAG-1-15X15": 31.28,
    "GLOBAL-TATT-S": 31.28,
    "GLOBAL-TATT-M": 31.28,
    "GLOBAL-TATT-L": 31.28,
  },
  GB: {
    "M-STI-3X4": 2.85,
    "M-STI-5_5X5_5": 2.85,
    "M-STI-8_5X8_5": 4.28,
    "MAG-1-10X10": 2.85,
    "MAG-1-15X15": 2.85,
    "GLOBAL-TATT-S": 2.85,
    "GLOBAL-TATT-M": 2.85,
    "GLOBAL-TATT-L": 2.85,
  },
  DE: {
    "M-STI-3X4": 4.01,
    "M-STI-5_5X5_5": 4.01,
    "M-STI-8_5X8_5": 6.11,
    "MAG-1-10X10": 4.01,
    "MAG-1-15X15": 4.01,
    "GLOBAL-TATT-S": 4.01,
    "GLOBAL-TATT-M": 4.01,
    "GLOBAL-TATT-L": 4.01,
  },
  FR: {
    "M-STI-3X4": 11.20,
    "M-STI-5_5X5_5": 11.20,
    "M-STI-8_5X8_5": 12.56,
    "MAG-1-10X10": 11.20,
    "MAG-1-15X15": 11.20,
    "GLOBAL-TATT-S": 11.20,
    "GLOBAL-TATT-M": 11.20,
    "GLOBAL-TATT-L": 11.20,
  },
  IT: {
    "M-STI-3X4": 14.19,
    "M-STI-5_5X5_5": 14.19,
    "M-STI-8_5X8_5": 16.90,
    "MAG-1-10X10": 14.19,
    "MAG-1-15X15": 14.19,
    "GLOBAL-TATT-S": 14.19,
    "GLOBAL-TATT-M": 14.19,
    "GLOBAL-TATT-L": 14.19,
  },
  ES: {
    "M-STI-3X4": 32.52,
    "M-STI-5_5X5_5": 32.52,
    "M-STI-8_5X8_5": 32.52,
    "MAG-1-10X10": 32.52,
    "MAG-1-15X15": 32.52,
    "GLOBAL-TATT-S": 32.52,
    "GLOBAL-TATT-M": 32.52,
    "GLOBAL-TATT-L": 32.52,
  },
  CA: {
    "M-STI-3X4": 4.75,
    "M-STI-5_5X5_5": 4.75,
    "M-STI-8_5X8_5": 6.72,
    "MAG-1-10X10": 4.75,
    "MAG-1-15X15": 4.75,
    "GLOBAL-TATT-S": 4.75,
    "GLOBAL-TATT-M": 4.75,
    "GLOBAL-TATT-L": 4.75,
  },
  AU: {
    "M-STI-3X4": 6.72,
    "M-STI-5_5X5_5": 6.72,
    "M-STI-8_5X8_5": 9.44,
    "MAG-1-10X10": 6.72,
    "MAG-1-15X15": 6.72,
    "GLOBAL-TATT-S": 6.72,
    "GLOBAL-TATT-M": 6.72,
    "GLOBAL-TATT-L": 6.72,
  },
  TH: {
    "M-STI-3X4": 18.94,
    "M-STI-5_5X5_5": 18.94,
    "M-STI-8_5X8_5": 18.94,
    "MAG-1-10X10": 18.94,
    "MAG-1-15X15": 18.94,
    "GLOBAL-TATT-S": 18.94,
    "GLOBAL-TATT-M": 18.94,
    "GLOBAL-TATT-L": 18.94,
  },
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

const DEFAULT_COUNTRY: CountryCode = "IL";

// --- Bulk discount tiers, per product -------------------------------------

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

function shippingUsdFor(
  country: CountryCode,
  type: ProductType,
  size: string,
): number | null {
  const variant = variantFor(type, size);
  if (!variant) return null;
  return SHIPPING_USD_BY_COUNTRY_SKU[country]?.[variant.sku] ?? null;
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
  country: CountryCode = DEFAULT_COUNTRY,
): PriceBreakdown {
  if (quantity < 1 || quantity > 50) {
    throw new Error(`quantity ${quantity} outside 1-50`);
  }
  const unitUsd = unitUsdFor(productType, size);
  const shippingUsd = shippingUsdFor(country, productType, size);
  if (unitUsd === null || shippingUsd === null) {
    throw new Error(`no pricing data for ${productType}/${size} → ${country}`);
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
// MAX shipping rate across all lines (not the sum).
export function priceForCart(
  items: CartPriceItem[],
  country: CountryCode = DEFAULT_COUNTRY,
): CartPriceBreakdown {
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
    const shippingUsd = shippingUsdFor(country, it.productType, it.size);
    if (unitUsd === null || shippingUsd === null) {
      throw new Error(
        `no pricing data for ${it.productType}/${it.size} → ${country}`,
      );
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
