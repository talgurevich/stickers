"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  removeItem,
  updateQuantity,
  useCart,
  useHasMounted,
} from "@/lib/cart";
import { formatIls, priceForCart, type CartPriceBreakdown } from "@/lib/pricing";
import { variantFor, PRODUCT_LABELS_HE } from "@/lib/prodigi-catalog";
import {
  SUPPORTED_COUNTRIES,
  isSupportedCountry,
  type CountryCode,
} from "@/lib/countries";

type Address = {
  name: string;
  street: string;
  city: string;
  zip: string;
  country: CountryCode;
  phone?: string;
  email?: string;
};

export default function CartPage() {
  const cart = useCart();
  const mounted = useHasMounted();
  const router = useRouter();

  const [address, setAddress] = useState<Address>({
    name: "",
    street: "",
    city: "",
    zip: "",
    country: "IL",
  });
  const [displayPublicly, setDisplayPublicly] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  let price: CartPriceBreakdown | null = null;
  try {
    if (cart.items.length > 0) {
      price = priceForCart(
        cart.items.map((i) => ({
          productType: i.productType,
          size: i.size,
          quantity: i.quantity,
        })),
        address.country,
      );
    }
  } catch {
    price = null;
  }

  async function pay() {
    if (!price || cart.items.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/checkout/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.items.map((i) => ({
            sessionId: i.sessionId,
            imagePath: i.imagePath,
            productType: i.productType,
            size: i.size,
            quantity: i.quantity,
          })),
          address,
          displayPublicly,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(j.error ?? "שגיאה בפתיחת התשלום");
        return;
      }
      router.push(j.redirectUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  // First paint = SSR shape (cart looks empty); swap in real cart once mounted
  // so the user doesn't see a flash of "empty cart" then content.
  if (!mounted) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <p className="text-zinc-500">טוען סל...</p>
      </main>
    );
  }

  if (cart.items.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="mb-4 text-3xl font-bold">הסל ריק</h1>
        <p className="mb-6 text-sm text-zinc-500">
          הוסיפו פריטים כדי לראות אותם כאן. כל הפריטים נשלחים במשלוח אחד.
        </p>
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          להוספת פריט
        </Link>
      </main>
    );
  }

  const emailValid = Boolean(address.email && /\S+@\S+\.\S+/.test(address.email));
  const canPay =
    Boolean(price) &&
    Boolean(address.name && address.street && address.city && address.zip) &&
    emailValid;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <h1 className="mb-8 text-3xl font-bold">הסל שלכם</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <section className="space-y-4">
          <ul className="space-y-3">
            {cart.items.map((item) => {
              const variant = variantFor(item.productType, item.size);
              const lineProduct = price?.lines.find(
                (l) =>
                  l.productType === item.productType &&
                  l.size === item.size &&
                  l.quantity === item.quantity,
              );
              const productLabel = PRODUCT_LABELS_HE[item.productType];
              return (
                <li
                  key={`${item.sessionId}-${item.productType}`}
                  className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded-lg object-contain bg-zinc-50 dark:bg-zinc-950"
                    />
                  ) : (
                    <div className="h-20 w-20 shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {productLabel}
                      {variant ? ` · ${variant.labelHe}` : ""}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() =>
                          updateQuantity(
                            item.sessionId,
                            item.productType,
                            item.quantity - 1,
                          )
                        }
                        className="h-8 w-8 rounded-full border border-zinc-300 dark:border-zinc-700"
                      >
                        –
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={item.quantity}
                        onChange={(e) =>
                          updateQuantity(
                            item.sessionId,
                            item.productType,
                            Number(e.target.value) || 1,
                          )
                        }
                        className="h-8 w-16 rounded-md border border-zinc-300 text-center text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        dir="ltr"
                      />
                      <button
                        onClick={() =>
                          updateQuantity(
                            item.sessionId,
                            item.productType,
                            item.quantity + 1,
                          )
                        }
                        className="h-8 w-8 rounded-full border border-zinc-300 dark:border-zinc-700"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold">
                      {lineProduct
                        ? formatIls(lineProduct.productAgorot)
                        : "—"}
                    </div>
                    {lineProduct && lineProduct.bulkDiscount > 0 && (
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                        −{Math.round(lineProduct.bulkDiscount * 100)}%
                      </div>
                    )}
                    <button
                      onClick={() =>
                        removeItem(item.sessionId, item.productType)
                      }
                      className="mt-1 text-xs text-red-600 hover:underline dark:text-red-400"
                    >
                      הסירו
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <Link
            href="/?continue=1"
            className="inline-block text-sm text-emerald-700 hover:underline dark:text-emerald-400"
          >
            + הוספת פריט נוסף
          </Link>

          <div>
            <h2 className="mt-6 mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              כתובת למשלוח
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-xs text-zinc-500">מדינה</span>
                <select
                  value={address.country}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (isSupportedCountry(v)) {
                      setAddress({ ...address, country: v });
                    }
                  }}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {SUPPORTED_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.he}
                    </option>
                  ))}
                </select>
              </label>
              <input
                placeholder="שם מלא"
                value={address.name}
                onChange={(e) =>
                  setAddress({ ...address, name: e.target.value })
                }
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900 sm:col-span-2"
              />
              <input
                placeholder="רחוב ומספר"
                value={address.street}
                onChange={(e) =>
                  setAddress({ ...address, street: e.target.value })
                }
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900 sm:col-span-2"
              />
              <input
                placeholder="עיר"
                value={address.city}
                onChange={(e) =>
                  setAddress({ ...address, city: e.target.value })
                }
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
              <input
                placeholder="מיקוד"
                value={address.zip}
                onChange={(e) =>
                  setAddress({ ...address, zip: e.target.value })
                }
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                dir="ltr"
              />
              <input
                type="email"
                placeholder="אימייל"
                value={address.email ?? ""}
                onChange={(e) =>
                  setAddress({ ...address, email: e.target.value })
                }
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900 sm:col-span-2"
                dir="ltr"
                required
              />
              <p className="text-xs text-zinc-500 sm:col-span-2">
                האימייל משמש לאישור הזמנה ולעדכוני משלוח.
              </p>
              {address.country !== "IL" && (
                <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 sm:col-span-2 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
                  למשלוחים מחוץ לישראל: ייתכן מע״מ/מכס במדינת היעד באחריות
                  המקבל. זמני משלוח 7-21 ימי עסקים.
                </p>
              )}
            </div>
          </div>

          <label className="mt-4 flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 text-right dark:border-zinc-800 dark:bg-zinc-900/50">
            <input
              type="checkbox"
              checked={displayPublicly}
              onChange={(e) => setDisplayPublicly(e.target.checked)}
              className="mt-1 h-4 w-4 accent-emerald-600"
            />
            <span className="flex-1 text-sm">
              <span className="block font-medium">
                להציג את המדבקות בפיד הציבורי
              </span>
              <span className="block text-xs text-zinc-500">
                התמונות יוצגו ללא שם או פרטי קשר ב־&quot;הודפסו לאחרונה&quot;
                שבדף הבית. הסירו את הסימון אם אתם מעדיפים להזמין באופן פרטי.
              </span>
            </span>
          </label>
        </section>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-lg font-bold">סיכום הזמנה</h3>
            {price && (
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">פריטים</dt>
                  <dd>
                    {price.productAgorot < price.productBeforeDiscountAgorot && (
                      <span className="me-2 text-xs text-zinc-400 line-through">
                        {formatIls(price.productBeforeDiscountAgorot)}
                      </span>
                    )}
                    {formatIls(price.productAgorot)}
                  </dd>
                </div>
                {price.productAgorot < price.productBeforeDiscountAgorot && (
                  <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                    <dt>הנחת כמות</dt>
                    <dd>
                      −
                      {formatIls(
                        price.productBeforeDiscountAgorot - price.productAgorot,
                      )}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-zinc-500">משלוח (אחד לכל ההזמנה)</dt>
                  <dd>{formatIls(price.shippingAgorot)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">עמלה</dt>
                  <dd>{formatIls(price.handlingAgorot)}</dd>
                </div>
                <div className="flex justify-between pt-2 text-base font-bold">
                  <dt>סך הכל</dt>
                  <dd>{formatIls(price.totalAgorot)}</dd>
                </div>
              </dl>
            )}
            <button
              onClick={pay}
              disabled={!canPay || busy}
              className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-full bg-zinc-900 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {busy ? "שולח הזמנה..." : "אישור הזמנה (מצב בדיקה)"}
            </button>
            {err && (
              <pre className="rounded-md bg-red-50 p-3 text-right text-xs text-red-900 whitespace-pre-wrap dark:bg-red-950/40 dark:text-red-200">
                {err}
              </pre>
            )}
            <p className="text-xs text-zinc-500">
              מצב בדיקה — אין חיוב כרגע. ההזמנה נשלחת ל־Prodigi (UK)
              כטיוטה לאישור; משלוח 7-21 ימי עסקים לפי מדינת היעד.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
