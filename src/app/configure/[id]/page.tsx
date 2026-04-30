"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { priceFor, formatIls, type PriceBreakdown } from "@/lib/pricing";
import { getVariantId, type CutType, type SizeMm } from "@/lib/printful-catalog";

type Address = {
  name: string;
  street: string;
  city: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
};

type SessionView = {
  id: string;
  phone: string;
  status: string;
  imageUrl?: string;
  config?: {
    sizeMm?: SizeMm;
    cut?: CutType;
    quantity?: number;
    address?: Address;
  };
};

const SIZES: SizeMm[] = [50, 70, 100];

export default function ConfigurePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionView | null>(null);

  const [sizeMm, setSizeMm] = useState<SizeMm>(70);
  const [cut, setCut] = useState<CutType>("kiss_cut");
  const [quantity, setQuantity] = useState(1);
  const [address, setAddress] = useState<Address>({
    name: "",
    street: "",
    city: "",
    zip: "",
    country: "IL",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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

  // Lock 5 cm to die-cut: Printful doesn't sell a 2" kiss-cut. See BRIEF.md.
  const variantId = getVariantId(cut, sizeMm);
  const variantUnavailable = variantId === null;

  let price: PriceBreakdown | null = null;
  try {
    price = priceFor(sizeMm, cut, quantity);
  } catch {
    price = null;
  }

  async function pay() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/sessions/${id}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sizeMm, cut, quantity, address }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(j.error ?? "שגיאה בפתיחת התשלום");
        return;
      }
      window.location.href = j.paymentPageLink;
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-zinc-500">טוען...</p>
      </main>
    );
  }

  const canPay =
    !variantUnavailable &&
    Boolean(price) &&
    Boolean(address.name && address.street && address.city && address.zip);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <h1 className="mb-8 text-3xl font-bold">בנו את המדבקה שלכם</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* LEFT: image + selectors */}
        <section className="space-y-8">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-center">
              {session.imageUrl ? (
                <Image
                  src={session.imageUrl}
                  alt="המדבקה שלך"
                  width={320}
                  height={320}
                  unoptimized
                  className="rounded-lg object-contain"
                  style={{
                    width: `${sizeMm * 2.4}px`,
                    height: `${sizeMm * 2.4}px`,
                    maxWidth: "100%",
                  }}
                />
              ) : (
                <p className="text-zinc-500">לא הועלתה תמונה</p>
              )}
            </div>
          </div>

          {/* Size */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              גודל
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSizeMm(s)}
                  className={
                    "rounded-lg border-2 px-4 py-3 text-center transition " +
                    (sizeMm === s
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                      : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800")
                  }
                >
                  <div className="text-lg font-bold">{s / 10} ס״מ</div>
                  <div className="text-xs text-zinc-500">{s / 25.4 < 2.1 ? "~2″" : s / 25.4 < 3 ? "~3″" : "~4″"}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Cut */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              סוג חיתוך
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setCut("kiss_cut")}
                disabled={getVariantId("kiss_cut", sizeMm) === null}
                className={
                  "rounded-lg border-2 px-4 py-3 text-right transition disabled:opacity-40 " +
                  (cut === "kiss_cut"
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                    : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800")
                }
              >
                <div className="font-bold">Kiss-cut</div>
                <div className="text-xs text-zinc-500">
                  על דף עם מסגרת לבנה
                </div>
              </button>
              <button
                onClick={() => setCut("rectangle")}
                className={
                  "rounded-lg border-2 px-4 py-3 text-right transition " +
                  (cut === "rectangle"
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                    : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800")
                }
              >
                <div className="font-bold">Die-cut</div>
                <div className="text-xs text-zinc-500">חתוך לפי המדבקה</div>
              </button>
            </div>
            {variantUnavailable && (
              <p className="mt-2 text-xs text-amber-600">
                בגודל זה אין כרגע אופציה ל־kiss-cut. בחר/י גודל אחר או die-cut.
              </p>
            )}
          </div>

          {/* Quantity */}
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
              {quantity >= 10 ? (
                <span className="text-xs font-medium text-emerald-600">
                  20% הנחת כמות
                </span>
              ) : quantity >= 5 ? (
                <span className="text-xs font-medium text-emerald-600">
                  10% הנחת כמות
                </span>
              ) : null}
            </div>
          </div>

          {/* Address */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              כתובת למשלוח (ישראל בלבד ב־MVP)
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                placeholder="שם מלא"
                value={address.name}
                onChange={(e) => setAddress({ ...address, name: e.target.value })}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900 sm:col-span-2"
              />
              <input
                placeholder="רחוב ומספר"
                value={address.street}
                onChange={(e) => setAddress({ ...address, street: e.target.value })}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900 sm:col-span-2"
              />
              <input
                placeholder="עיר"
                value={address.city}
                onChange={(e) => setAddress({ ...address, city: e.target.value })}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
              <input
                placeholder="מיקוד"
                value={address.zip}
                onChange={(e) => setAddress({ ...address, zip: e.target.value })}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                dir="ltr"
              />
              <input
                placeholder="אימייל (אופציונלי)"
                value={address.email ?? ""}
                onChange={(e) => setAddress({ ...address, email: e.target.value })}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900 sm:col-span-2"
                dir="ltr"
              />
            </div>
          </div>
        </section>

        {/* RIGHT: order summary */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-lg font-bold">סיכום הזמנה</h3>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">גודל</dt>
                <dd>{sizeMm / 10} ס״מ</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">חיתוך</dt>
                <dd>{cut === "kiss_cut" ? "Kiss-cut" : "Die-cut"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">כמות</dt>
                <dd>{quantity}</dd>
              </div>
            </dl>
            <hr className="border-zinc-200 dark:border-zinc-800" />
            {price && (
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">מדבקות</dt>
                  <dd>{formatIls(price.productAgorot)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">משלוח</dt>
                  <dd>{formatIls(price.shippingAgorot)}</dd>
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
              {busy ? "פותח דף תשלום..." : "מעבר לתשלום"}
            </button>
            {err && (
              <pre className="rounded-md bg-red-50 p-3 text-right text-xs text-red-900 whitespace-pre-wrap dark:bg-red-950/40 dark:text-red-200">
                {err}
              </pre>
            )}
            <p className="text-xs text-zinc-500">
              תשלום מאובטח דרך PayPlus. משלוח ל־7-14 ימי עסקים.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
