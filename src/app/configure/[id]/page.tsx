"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { priceFor, formatIls, type PriceBreakdown } from "@/lib/pricing";
import {
  DEFAULT_SIZE_BY_PRODUCT,
  PRODUCT_LABELS_HE,
  variantFor,
  variantsForProduct,
  isProductType,
  isSizeForProduct,
  type ProductType,
} from "@/lib/prodigi-catalog";
import { addItem, useCart } from "@/lib/cart";

type SessionView = {
  id: string;
  phone: string;
  status: string;
  imageUrl?: string | null;
  imagePath?: string | null;
};

const PRODUCT_OPTIONS: ProductType[] = ["sticker", "magnet", "tattoo"];

// Per-product blurb shown under the size grid. Honest about what the
// product is so buyers don't expect sticker-style longevity from a tattoo.
const PRODUCT_BLURB_HE: Record<ProductType, string> = {
  sticker: "חיתוך kiss-cut על נייר ויניל מט. עמיד למים, עד 18 חודשים בחוץ.",
  magnet: "מגנט פוטו עבה (0.6 מ״מ) — נדבק לכל משטח מתכתי. מתאים למקרר, לוח, ארון.",
  tattoo: "טטו זמני להדבקה על העור. מתחזק 3-5 ימים, מורד בקלות עם שמן או אלכוהול. בטוח לעור (3+).",
};

// Per-product bulk discount tiers shown in the side panel. Mirror what
// pricing.ts actually applies — keep these in sync if the tiers change.
const BULK_TIERS_HE: Record<ProductType, string[]> = {
  sticker: ["5+ — 10% הנחה", "10+ — 20% הנחה", "20+ — 30% הנחה"],
  magnet: [
    "3+ — 5% הנחה",
    "5+ — 12% הנחה",
    "10+ — 18% הנחה",
    "20+ — 25% הנחה",
  ],
  tattoo: ["5+ — 15% הנחה", "10+ — 25% הנחה", "20+ — 35% הנחה"],
};

export default function ConfigurePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const cart = useCart();
  const [session, setSession] = useState<SessionView | null>(null);

  // If the user already configured this image as the same product, pre-fill
  // from the existing line. Otherwise default to sticker.
  const existingSticker = cart.items.find(
    (i) => i.sessionId === id && i.productType === "sticker",
  );
  const existingForProduct = useMemo(
    () => cart.items.filter((i) => i.sessionId === id),
    [cart.items, id],
  );
  const seedProduct: ProductType =
    (existingForProduct[0]?.productType as ProductType) ?? "sticker";
  const seedSize =
    existingForProduct[0]?.size ?? DEFAULT_SIZE_BY_PRODUCT[seedProduct];

  const [productType, setProductType] = useState<ProductType>(seedProduct);
  const [size, setSize] = useState<string>(seedSize);
  const [quantity, setQuantity] = useState(existingForProduct[0]?.quantity ?? 1);

  useEffect(() => {
    fetch(`/api/sessions/${id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: SessionView | null) => {
        if (!j) {
          router.push("/");
          return;
        }
        setSession(j);
      });
  }, [id, router]);

  // Switching products invalidates the current size — reset to the new
  // product's default. Keep the existing line's selection if there is one.
  function pickProduct(next: ProductType) {
    if (next === productType) return;
    const existing = cart.items.find(
      (i) => i.sessionId === id && i.productType === next,
    );
    setProductType(next);
    setSize(existing?.size ?? DEFAULT_SIZE_BY_PRODUCT[next]);
    setQuantity(existing?.quantity ?? 1);
  }

  const variants = variantsForProduct(productType);
  const variant = variantFor(productType, size);

  let price: PriceBreakdown | null = null;
  if (variant && isSizeForProduct(productType, size)) {
    try {
      price = priceFor(productType, size, quantity);
    } catch {
      price = null;
    }
  }

  function addToCart(opts: { thenGo: "cart" | "more" }) {
    if (!session?.imagePath || !variant) return;
    if (!isProductType(productType)) return;
    addItem({
      sessionId: id,
      imagePath: session.imagePath,
      imageUrl: session.imageUrl ?? null,
      productType,
      size,
      quantity,
    });
    if (opts.thenGo === "cart") router.push("/cart");
    else router.push("/");
  }

  if (!session) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-zinc-500">טוען...</p>
      </main>
    );
  }

  if (!variant) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-zinc-500">שגיאה: גודל לא תקין</p>
      </main>
    );
  }

  // Preview width — scale 1mm to ~2.4 px so the displayed product has roughly
  // the right proportional feel on screen (capped by container).
  const previewW = Math.min(420, variant.widthMm * 2.4);
  const previewH = Math.min(420, variant.heightMm * 2.4);

  const cartCount = cart.items.reduce((n, i) => n + i.quantity, 0);
  const productLabelSingular = PRODUCT_LABELS_HE[productType];

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <h1 className="mb-8 text-3xl font-bold">בנו את ה{productLabelSingular} שלכם</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <section className="space-y-8">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-center">
              {session.imageUrl ? (
                <Image
                  src={session.imageUrl}
                  alt="התמונה שלך"
                  width={420}
                  height={420}
                  unoptimized
                  className="rounded-lg object-contain"
                  style={{
                    width: `${previewW}px`,
                    height: `${previewH}px`,
                    maxWidth: "100%",
                  }}
                />
              ) : (
                <p className="text-zinc-500">לא הועלתה תמונה</p>
              )}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              סוג מוצר
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {PRODUCT_OPTIONS.map((p) => (
                <button
                  key={p}
                  onClick={() => pickProduct(p)}
                  className={
                    "rounded-lg border-2 px-4 py-3 text-center transition " +
                    (productType === p
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                      : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800")
                  }
                >
                  <div className="text-base font-bold">
                    {PRODUCT_LABELS_HE[p]}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              גודל
            </h2>
            <div
              className={
                "grid gap-3 " +
                (variants.length === 2 ? "grid-cols-2" : "grid-cols-3")
              }
            >
              {variants.map((v) => (
                <button
                  key={v.size}
                  onClick={() => setSize(v.size)}
                  className={
                    "rounded-lg border-2 px-4 py-3 text-center transition " +
                    (size === v.size
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                      : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800")
                  }
                >
                  <div className="text-base font-bold">
                    {v.labelHe.split(" · ")[0]}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {v.labelHe.split(" · ")[1]}
                  </div>
                  <div className="mt-1 text-[10px] uppercase text-zinc-400">
                    {v.shape === "square" ? "ריבוע" : "מלבן"}
                  </div>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              {PRODUCT_BLURB_HE[productType]}
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              כמות
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="h-10 w-10 rounded-full border border-zinc-300 text-lg dark:border-zinc-700"
              >
                –
              </button>
              <input
                type="number"
                min={1}
                max={50}
                value={quantity}
                onChange={(e) =>
                  setQuantity(Math.max(1, Math.min(50, Number(e.target.value) || 1)))
                }
                className="h-10 w-20 rounded-lg border border-zinc-300 text-center text-lg dark:border-zinc-700 dark:bg-zinc-900"
                dir="ltr"
              />
              <button
                onClick={() => setQuantity(Math.min(50, quantity + 1))}
                className="h-10 w-10 rounded-full border border-zinc-300 text-lg dark:border-zinc-700"
              >
                +
              </button>
              {price && (
                <span className="text-xs font-medium text-emerald-600">
                  {formatIls(price.perUnitAgorot)} ליחידה
                </span>
              )}
            </div>
            {price && (
              <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900/60">
                <div className="font-semibold text-zinc-700 dark:text-zinc-200">
                  ככל שמזמינים יותר, המחיר ליחידה יורד:
                </div>
                <ul className="mt-1 space-y-0.5 text-zinc-500">
                  {BULK_TIERS_HE[productType].map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {price.bulkDiscount > 0 && (
                  <div className="mt-2 font-medium text-emerald-600">
                    ✓ קיבלת {Math.round(price.bulkDiscount * 100)}% הנחה
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-lg font-bold">סיכום הפריט</h3>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">סוג</dt>
                <dd>{productLabelSingular}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">גודל</dt>
                <dd>{variant.labelHe}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">כמות</dt>
                <dd>{quantity}</dd>
              </div>
            </dl>
            {price && (
              <>
                <hr className="border-zinc-200 dark:border-zinc-800" />
                <dl className="space-y-1 text-sm">
                  <div className="flex items-baseline justify-between">
                    <dt className="text-zinc-500">מחיר ליחידה</dt>
                    <dd className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {formatIls(price.perUnitAgorot)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">סך הפריט</dt>
                    <dd className="font-semibold">
                      {price.bulkDiscount > 0 && (
                        <span className="me-2 text-xs text-zinc-400 line-through">
                          {formatIls(price.productBeforeDiscountAgorot)}
                        </span>
                      )}
                      {formatIls(price.productAgorot)}
                    </dd>
                  </div>
                  <p className="text-xs text-zinc-500">
                    מחיר ליחידה כולל משלוח לכלל ההזמנה. הסכום הסופי בסל.
                  </p>
                </dl>
              </>
            )}
            <button
              onClick={() => addToCart({ thenGo: "cart" })}
              disabled={!price || !session.imagePath}
              className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-full bg-emerald-600 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
            >
              {existingSticker ? "עדכון בסל ומעבר לסל" : "הוספה לסל ומעבר לסל"}
            </button>
            <button
              onClick={() => addToCart({ thenGo: "more" })}
              disabled={!price || !session.imagePath}
              className="inline-flex h-12 w-full items-center justify-center rounded-full border border-zinc-300 bg-white text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
            >
              הוספה לסל והוספת מוצר נוסף
            </button>
            {cartCount > 0 && (
              <p className="text-center text-xs text-zinc-500">
                בסל כבר {cartCount} פריטים
              </p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
