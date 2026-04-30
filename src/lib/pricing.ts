// Sticker pricing — placeholder curves until we plug in real Prodigi costs
// and a markup decision. All amounts in agorot (₪0.01).

import type { StickerSize } from "./prodigi-catalog";

const BASE_PRICE_AGOROT: Record<StickerSize, number> = {
  small: 1500, // ~₪15 — 7.6×10 cm
  medium: 2500, // ~₪25 — 14×14 cm
  large: 3500, // ~₪35 — 21.6×21.6 cm
  xlarge: 5500, // ~₪55 — 35×35 cm
};

const SHIPPING_FLAT_AGOROT = 2500; // ₪25 IL flat — Prodigi ships from EU/UK to IL

export type PriceBreakdown = {
  productAgorot: number;
  shippingAgorot: number;
  totalAgorot: number;
};

export function priceFor(
  size: StickerSize,
  quantity: number,
): PriceBreakdown {
  if (quantity < 1 || quantity > 50) {
    throw new Error(`quantity ${quantity} outside 1-50`);
  }
  const unit = BASE_PRICE_AGOROT[size];
  const discount = quantity >= 10 ? 0.2 : quantity >= 5 ? 0.1 : 0;
  const productAgorot = Math.round(unit * quantity * (1 - discount));
  return {
    productAgorot,
    shippingAgorot: SHIPPING_FLAT_AGOROT,
    totalAgorot: productAgorot + SHIPPING_FLAT_AGOROT,
  };
}

export function formatIls(agorot: number): string {
  return `₪${(agorot / 100).toFixed(2).replace(/\.00$/, "")}`;
}
