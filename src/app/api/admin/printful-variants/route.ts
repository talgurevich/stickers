import { NextResponse } from "next/server";
import {
  listCatalogProducts,
  getCatalogProductVariants,
  PrintfulError,
} from "@/lib/printful";

export const runtime = "nodejs";

// Debug endpoint: hits Printful catalog, returns the sticker products + their
// variants so we can pick the right catalog_variant_id for each
// (size_mm × cut_type) combo we offer. Throw-away once IDs are pinned.
export async function GET() {
  try {
    const products = await listCatalogProducts({ types: "STICKER" });
    const stickerProducts = products.data ?? [];

    const enriched = await Promise.all(
      stickerProducts.map(async (p) => {
        try {
          const v = await getCatalogProductVariants(p.id);
          return {
            id: p.id,
            name: p.name,
            type: p.type,
            techniques: p.techniques,
            variant_count: v.data?.length ?? 0,
            variants: v.data,
          };
        } catch (e) {
          return {
            id: p.id,
            name: p.name,
            type: p.type,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }),
    );

    return NextResponse.json({ count: enriched.length, products: enriched });
  } catch (e) {
    if (e instanceof PrintfulError) {
      return NextResponse.json(
        { error: e.message, status: e.status, raw: e.raw },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
