// Sticker pricing — placeholder curves until we plug in real Printful costs
// and a markup decision (see BRIEF.md "Open decisions").
//
// All amounts in agorot (₪0.01) — same unit the orders table uses, avoids
// floating-point drift. Returned numbers are integers.

import type { CutType, SizeMm } from "./printful-catalog";

const BASE_PRICE_AGOROT: Record<SizeMm, number> = {
  50: 1500, // ₪15
  70: 2000, // ₪20
  100: 2800, // ₪28
};

const KISS_CUT_PREMIUM_AGOROT = 200; // ₪2 over die-cut for the white border

const SHIPPING_FLAT_AGOROT = 2000; // ₪20 IL flat for MVP

export type PriceBreakdown = {
  productAgorot: number;
  shippingAgorot: number;
  totalAgorot: number;
};

export function priceFor(
  sizeMm: SizeMm,
  cut: CutType,
  quantity: number,
): PriceBreakdown {
  if (quantity < 1 || quantity > 50) {
    throw new Error(`quantity ${quantity} outside 1-50`);
  }
  const unit =
    BASE_PRICE_AGOROT[sizeMm] + (cut === "kiss_cut" ? KISS_CUT_PREMIUM_AGOROT : 0);
  const discount = quantity >= 10 ? 0.2 : quantity >= 5 ? 0.1 : 0;
  const productAgorot = Math.round(unit * quantity * (1 - discount));
  const shippingAgorot = SHIPPING_FLAT_AGOROT;
  return {
    productAgorot,
    shippingAgorot,
    totalAgorot: productAgorot + shippingAgorot,
  };
}

export function formatIls(agorot: number): string {
  return `₪${(agorot / 100).toFixed(2).replace(/\.00$/, "")}`;
}
