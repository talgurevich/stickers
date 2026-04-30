// Printful catalog variant matrix for our MVP sticker offering.
// Discovered 2026-04-30 via /api/admin/printful-variants and direct catalog
// paging. Product IDs are 358 (Kiss-Cut Stickers) and 957 (Die-Cut Stickers).
//
// Note: Printful sells in inches; the brief uses metric. 1 inch ≈ 2.54 cm.
//
// Kiss-Cut: square, white border around the print, on a backing sheet.
// Die-Cut:  cut to the print's outline, no border.
//
// Important MVP gap: there is NO 2″ (≈5 cm) kiss-cut variant.
// Either drop the 5 cm × kiss-cut combo from the picker, or restrict 5 cm
// to die-cut only. Keeping the matrix nullable so the UI can disable that cell.

export type SizeMm = 50 | 70 | 100;
export type CutType = "kiss_cut" | "rectangle"; // "rectangle" → die-cut on Printful

export const PRINTFUL_VARIANTS: Record<
  CutType,
  Record<SizeMm, number | null>
> = {
  kiss_cut: {
    50: null, // not offered
    70: 10163, // 3″×3″
    100: 10164, // 4″×4″
  },
  rectangle: {
    50: 24964, // 2″×2″
    70: 24965, // 3″×3″
    100: 24966, // 4″×4″
  },
};

export function getVariantId(cut: CutType, sizeMm: SizeMm): number | null {
  return PRINTFUL_VARIANTS[cut][sizeMm];
}
