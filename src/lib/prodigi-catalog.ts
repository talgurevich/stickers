// Prodigi product catalog. Verified live against Prodigi /products + /quotes
// (IL shipping) on the dates noted per section.
//
// We carry three product lines, all single-piece SKUs (multi-pack SKUs like
// MAG-4-* are deliberately excluded so the qty=N → N pieces invariant holds
// across the whole UI).

export type ProductType = "sticker" | "magnet" | "tattoo";

export type StickerSize = "small" | "medium" | "large" | "xlarge";
export type MagnetSize = "small" | "large";
export type TattooSize = "s" | "m" | "l";

// Discriminated union — each variant tags itself with productType, so a
// single (productType, size) pair is enough to look anything up.
export type ProductVariant =
  | (BaseVariant & { productType: "sticker"; size: StickerSize })
  | (BaseVariant & { productType: "magnet"; size: MagnetSize })
  | (BaseVariant & { productType: "tattoo"; size: TattooSize });

type BaseVariant = {
  sku: string;
  /** Width × height in mm, longest side first. */
  widthMm: number;
  heightMm: number;
  /** Hebrew display label, e.g. "קטן · 7.6×10 ס״מ". */
  labelHe: string;
  /** Plain English label. */
  labelEn: string;
  shape: "square" | "rectangle";
};

// --- Stickers (kiss-cut matt vinyl, verified 2026-04-30) ------------------
export const STICKER_VARIANTS: Record<StickerSize, ProductVariant> = {
  small: {
    productType: "sticker",
    size: "small",
    sku: "M-STI-3X4",
    widthMm: 76,
    heightMm: 101,
    labelHe: "קטן · 7.6×10 ס״מ",
    labelEn: "Small · 7.6×10 cm",
    shape: "rectangle",
  },
  medium: {
    productType: "sticker",
    size: "medium",
    sku: "M-STI-5_5X5_5",
    widthMm: 140,
    heightMm: 140,
    labelHe: "בינוני · 14×14 ס״מ",
    labelEn: "Medium · 14×14 cm",
    shape: "square",
  },
  large: {
    productType: "sticker",
    size: "large",
    sku: "M-STI-8_5X8_5",
    widthMm: 216,
    heightMm: 216,
    labelHe: "גדול · 21.6×21.6 ס״מ",
    labelEn: "Large · 21.6×21.6 cm",
    shape: "square",
  },
  xlarge: {
    productType: "sticker",
    size: "xlarge",
    sku: "M-STI-14X14",
    widthMm: 356,
    heightMm: 356,
    labelHe: "ענק · 35.6×35.6 ס״מ",
    labelEn: "XL · 35.6×35.6 cm",
    shape: "square",
  },
};

// --- Magnets (single-piece photo magnets, verified 2026-05-02) ------------
// MAG-4-*/MAG-9-* multi-pack SKUs exist but are excluded — they would break
// the "qty=N is N pieces" invariant the rest of the UI assumes.
export const MAGNET_VARIANTS: Record<MagnetSize, ProductVariant> = {
  small: {
    productType: "magnet",
    size: "small",
    sku: "MAG-1-10X10",
    widthMm: 102,
    heightMm: 102,
    labelHe: "קטן · 10×10 ס״מ",
    labelEn: "Small · 10×10 cm",
    shape: "square",
  },
  large: {
    productType: "magnet",
    size: "large",
    sku: "MAG-1-15X15",
    widthMm: 152,
    heightMm: 152,
    labelHe: "גדול · 15×15 ס״מ",
    labelEn: "Large · 15×15 cm",
    shape: "square",
  },
};

// --- Temporary tattoos (single-design sheets, verified 2026-05-02) --------
// XL/XXL exist (200mm, 300mm) but skipped from the picker for MVP.
export const TATTOO_VARIANTS: Record<TattooSize, ProductVariant> = {
  s: {
    productType: "tattoo",
    size: "s",
    sku: "GLOBAL-TATT-S",
    widthMm: 50,
    heightMm: 75,
    labelHe: "קטן · 5×7.5 ס״מ",
    labelEn: "Small · 5×7.5 cm",
    shape: "rectangle",
  },
  m: {
    productType: "tattoo",
    size: "m",
    sku: "GLOBAL-TATT-M",
    widthMm: 75,
    heightMm: 100,
    labelHe: "בינוני · 7.5×10 ס״מ",
    labelEn: "Medium · 7.5×10 cm",
    shape: "rectangle",
  },
  l: {
    productType: "tattoo",
    size: "l",
    sku: "GLOBAL-TATT-L",
    widthMm: 100,
    heightMm: 150,
    labelHe: "גדול · 10×15 ס״מ",
    labelEn: "Large · 10×15 cm",
    shape: "rectangle",
  },
};

/** Sizes shown in the configurator picker per product. */
export const MVP_SIZES_BY_PRODUCT: {
  sticker: StickerSize[];
  magnet: MagnetSize[];
  tattoo: TattooSize[];
} = {
  sticker: ["small", "medium", "large"],
  magnet: ["small", "large"],
  tattoo: ["s", "m", "l"],
};

/** Default size when switching into a product (typically the smallest). */
export const DEFAULT_SIZE_BY_PRODUCT = {
  sticker: "medium" as StickerSize,
  magnet: "small" as MagnetSize,
  tattoo: "m" as TattooSize,
};

/** Hebrew product names for UI. */
export const PRODUCT_LABELS_HE: Record<ProductType, string> = {
  sticker: "מדבקה",
  magnet: "מגנט",
  tattoo: "קעקוע זמני",
};

/** Plural Hebrew product names. */
export const PRODUCT_LABELS_HE_PLURAL: Record<ProductType, string> = {
  sticker: "מדבקות",
  magnet: "מגנטים",
  tattoo: "קעקועים זמניים",
};

// --- Lookups --------------------------------------------------------------

export function variantsForProduct(type: ProductType): ProductVariant[] {
  switch (type) {
    case "sticker":
      return MVP_SIZES_BY_PRODUCT.sticker.map((s) => STICKER_VARIANTS[s]);
    case "magnet":
      return MVP_SIZES_BY_PRODUCT.magnet.map((s) => MAGNET_VARIANTS[s]);
    case "tattoo":
      return MVP_SIZES_BY_PRODUCT.tattoo.map((s) => TATTOO_VARIANTS[s]);
  }
}

export function variantFor(
  type: ProductType,
  size: string,
): ProductVariant | null {
  switch (type) {
    case "sticker":
      return isStickerSize(size) ? STICKER_VARIANTS[size] : null;
    case "magnet":
      return isMagnetSize(size) ? MAGNET_VARIANTS[size] : null;
    case "tattoo":
      return isTattooSize(size) ? TATTOO_VARIANTS[size] : null;
  }
}

/**
 * Back-compat: old code knew only stickers, so size strings were
 * "small"/"medium"/"large"/"xlarge". DB rows without product_type default
 * to sticker (see migration 0006), so this helper still works.
 */
export function variantForSize(size: StickerSize): ProductVariant {
  return STICKER_VARIANTS[size];
}

// --- Type guards ----------------------------------------------------------

export function isStickerSize(s: unknown): s is StickerSize {
  return s === "small" || s === "medium" || s === "large" || s === "xlarge";
}

export function isMagnetSize(s: unknown): s is MagnetSize {
  return s === "small" || s === "large";
}

export function isTattooSize(s: unknown): s is TattooSize {
  return s === "s" || s === "m" || s === "l";
}

export function isProductType(s: unknown): s is ProductType {
  return s === "sticker" || s === "magnet" || s === "tattoo";
}

export function isSizeForProduct(type: ProductType, size: unknown): boolean {
  switch (type) {
    case "sticker":
      return isStickerSize(size);
    case "magnet":
      return isMagnetSize(size);
    case "tattoo":
      return isTattooSize(size);
  }
}

// --- Legacy keep-around ---------------------------------------------------

/** @deprecated use MVP_SIZES_BY_PRODUCT.sticker */
export const MVP_SIZES: StickerSize[] = MVP_SIZES_BY_PRODUCT.sticker;
