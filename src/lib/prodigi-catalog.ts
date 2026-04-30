// Prodigi sticker catalog. Verified live against the Prodigi /products API
// 2026-04-30 with the wallaura account.
//
// Prodigi's sticker line is matt-vinyl kiss-cut at four sizes. Cut options
// other than kiss-cut aren't available at these SKUs, so MVP ships kiss-cut
// only. Sizes are real product dimensions (cm) — no aspirational rounding.

export type StickerSize = "small" | "medium" | "large" | "xlarge";

export type StickerVariant = {
  size: StickerSize;
  sku: string;
  /** Width × height in mm, longest side first. */
  widthMm: number;
  heightMm: number;
  /** Hebrew display label. */
  labelHe: string;
  /** Plain English label. */
  labelEn: string;
  /** Square or rectangle. */
  shape: "square" | "rectangle";
};

export const STICKER_VARIANTS: Record<StickerSize, StickerVariant> = {
  small: {
    size: "small",
    sku: "M-STI-3X4",
    widthMm: 76,
    heightMm: 101,
    labelHe: "קטן · 7.6×10 ס״מ",
    labelEn: "Small · 7.6×10 cm",
    shape: "rectangle",
  },
  medium: {
    size: "medium",
    sku: "M-STI-5_5X5_5",
    widthMm: 140,
    heightMm: 140,
    labelHe: "בינוני · 14×14 ס״מ",
    labelEn: "Medium · 14×14 cm",
    shape: "square",
  },
  large: {
    size: "large",
    sku: "M-STI-8_5X8_5",
    widthMm: 216,
    heightMm: 216,
    labelHe: "גדול · 21.6×21.6 ס״מ",
    labelEn: "Large · 21.6×21.6 cm",
    shape: "square",
  },
  xlarge: {
    size: "xlarge",
    sku: "M-STI-14X14",
    widthMm: 356,
    heightMm: 356,
    labelHe: "ענק · 35.6×35.6 ס״מ",
    labelEn: "XL · 35.6×35.6 cm",
    shape: "square",
  },
};

/** Sizes offered in the MVP configurator. XL ships but isn't in the picker. */
export const MVP_SIZES: StickerSize[] = ["small", "medium", "large"];

export function variantForSize(size: StickerSize): StickerVariant {
  return STICKER_VARIANTS[size];
}

export function isStickerSize(s: unknown): s is StickerSize {
  return s === "small" || s === "medium" || s === "large" || s === "xlarge";
}
