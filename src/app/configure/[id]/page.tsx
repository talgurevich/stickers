"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { priceFor, formatIls, type PriceBreakdown } from "@/lib/pricing";
import {
  MVP_SIZES,
  STICKER_VARIANTS,
  type StickerSize,
} from "@/lib/prodigi-catalog";
import { addItem, useCart } from "@/lib/cart";

type SessionView = {
  id: string;
  phone: string;
  status: string;
  imageUrl?: string | null;
  imagePath?: string | null;
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

  const existing = cart.items.find((i) => i.sessionId === id);
  const [size, setSize] = useState<StickerSize>(existing?.size ?? "medium");
  const [quantity, setQuantity] = useState(existing?.quantity ?? 1);

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

  let price: PriceBreakdown | null = null;
  try {
    price = priceFor(size, quantity);
  } catch {
    price = null;
  }

  const variant = STICKER_VARIANTS[size];

  function addToCart(opts: { thenGo: "cart" | "more" }) {
    if (!session?.imagePath) return;
    addItem({
      sessionId: id,
      imagePath: session.imagePath,
      imageUrl: session.imageUrl ?? null,
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

  // Preview width — scale 1mm to ~2.4 px so the displayed sticker has roughly
  // the right proportional feel on screen (capped by container).
  const previewW = Math.min(420, variant.widthMm * 2.4);
  const previewH = Math.min(420, variant.heightMm * 2.4);

  const cartCount = cart.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <h1 className="mb-8 text-3xl font-bold">בנו את המדבקה שלכם</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <section className="space-y-8">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-center">
              {session.imageUrl ? (
                <Image
                  src={session.imageUrl}
                  alt="המדבקה שלך"
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
              גודל
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {MVP_SIZES.map((s) => {
                const v = STICKER_VARIANTS[s];
                return (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={
                      "rounded-lg border-2 px-4 py-3 text-center transition " +
                      (size === s
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                        : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800")
                    }
                  >
                    <div className="text-base font-bold">{v.labelHe.split(" · ")[0]}</div>
                    <div className="text-xs text-zinc-500">
                      {v.labelHe.split(" · ")[1]}
                    </div>
                    <div className="mt-1 text-[10px] uppercase text-zinc-400">
                      {v.shape === "square" ? "ריבוע" : "מלבן"}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              חיתוך kiss-cut על נייר ויניל מט. עמיד למים, עד 18 חודשים בחוץ.
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
                  <li>5+ — 10% הנחה על המדבקות</li>
                  <li>10+ — 20% הנחה</li>
                  <li>20+ — 30% הנחה</li>
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
              {existing ? "עדכון בסל ומעבר לסל" : "הוספה לסל ומעבר לסל"}
            </button>
            <button
              onClick={() => addToCart({ thenGo: "more" })}
              disabled={!price || !session.imagePath}
              className="inline-flex h-12 w-full items-center justify-center rounded-full border border-zinc-300 bg-white text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
            >
              הוספה לסל והוספת מדבקה נוספת
            </button>
            {cartCount > 0 && (
              <p className="text-center text-xs text-zinc-500">
                בסל כבר {cartCount} {cartCount === 1 ? "מדבקה" : "מדבקות"}
              </p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
