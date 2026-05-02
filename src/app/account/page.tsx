"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  PRODUCT_LABELS_HE,
  isProductType,
  variantFor,
} from "@/lib/prodigi-catalog";
import { formatIls } from "@/lib/pricing";
import { getBrowserClient } from "@/lib/supabase-browser";

// Persist the phone client-side so navigating away from /account (e.g. to
// /cart and back) doesn't dump the user back at the login form. The phone
// itself isn't sensitive — it's the id we use everywhere — but offer a
// logout button so people on shared devices can wipe it.
const ACCOUNT_PHONE_KEY = "wallaura.account.phone.v1";

type OrderView = {
  id: string;
  productType?: string;
  size: string;
  quantity: number;
  totalAgorot: number;
  paidAt: string | null;
  fulfillmentId: string | null;
  fulfillmentStatus: string | null;
  createdAt: string;
  thumbUrl: string | null;
};

type SessionView = {
  id: string;
  phone: string;
};

export default function AccountPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [phoneSubmitted, setPhoneSubmitted] = useState(false);
  const [orders, setOrders] = useState<OrderView[] | null>(null);
  const [openSession, setOpenSession] = useState<SessionView | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Once a session is open, subscribe to Realtime — if a WhatsApp sticker
  // lands while the user is browsing this page, jump to /configure.
  useEffect(() => {
    if (!openSession) return;
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`session:${openSession.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${openSession.id}`,
        },
        (payload) => {
          const next = payload.new as { image_url?: string | null };
          if (next?.image_url) {
            router.push(`/configure/${openSession.id}`);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [openSession, router]);

  const performLogin = useCallback(
    async (phoneToUse: string) => {
      setBusy(true);
      setErr(null);
      try {
        const [sessionRes, ordersRes] = await Promise.all([
          fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: phoneToUse }),
          }),
          fetch("/api/account/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: phoneToUse }),
          }),
        ]);

        if (!sessionRes.ok) {
          const j = await sessionRes.json();
          setErr(j.error ?? `שגיאה ${sessionRes.status}`);
          return;
        }
        if (!ordersRes.ok) {
          const j = await ordersRes.json();
          setErr(j.error ?? `שגיאה ${ordersRes.status}`);
          return;
        }
        const sessionJson = await sessionRes.json();
        const ordersJson = await ordersRes.json();

        // Persist for next visit. Stored phone is whatever the user typed
        // — server normalizes again on POST so format doesn't matter here.
        try {
          window.localStorage.setItem(ACCOUNT_PHONE_KEY, phoneToUse);
        } catch {
          /* no-op (private mode etc.) */
        }

        // If the orphan sweep just attached an image, jump straight to /configure.
        if (sessionJson.orphanAdopted) {
          router.push(`/configure/${sessionJson.id}`);
          return;
        }

        setOpenSession({ id: sessionJson.id, phone: sessionJson.phone });
        setOrders(ordersJson.orders);
        setPhoneSubmitted(true);
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  async function logIn(e: React.FormEvent) {
    e.preventDefault();
    await performLogin(phone);
  }

  function logOut() {
    try {
      window.localStorage.removeItem(ACCOUNT_PHONE_KEY);
    } catch {
      /* no-op */
    }
    setPhone("");
    setPhoneSubmitted(false);
    setOpenSession(null);
    setOrders(null);
  }

  // On mount, if a phone is stored, auto-log-in. This keeps the user "in"
  // their account across navigations (e.g. /account → /cart → /account).
  useEffect(() => {
    let alive = true;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(ACCOUNT_PHONE_KEY);
    } catch {
      /* no-op */
    }
    if (!stored) return;
    // Syncing React state with localStorage on mount — the rule's preferred
    // alternatives (move to render, use useSyncExternalStore) don't fit a
    // one-shot async restore.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhone(stored);
    performLogin(stored).catch(() => {
      // If auto-restore fails (e.g. server rejects), fall back to the form.
      if (alive) logOut();
    });
    return () => {
      alive = false;
    };
  }, [performLogin]);

  async function reorder(orderId: string) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/account/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, phone }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(j.error ?? `HTTP ${res.status}`);
        return;
      }
      router.push(`/configure/${j.sessionId}`);
    } finally {
      setBusy(false);
    }
  }

  const servicePhone = process.env.NEXT_PUBLIC_SERVICE_PHONE;
  const formattedServicePhone = servicePhone
    ? `+${servicePhone.replace(/(\d{3})(\d{2})(\d{3})(\d{4})/, "$1 $2 $3 $4")}`
    : null;
  const waLink = servicePhone
    ? `https://wa.me/${servicePhone}?text=${encodeURIComponent("מצרפ.ת מדבקה")}`
    : "#";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">החשבון שלי</h1>
        {phoneSubmitted && (
          <button
            onClick={logOut}
            className="text-xs text-zinc-500 underline hover:text-zinc-900 dark:hover:text-white"
          >
            יציאה
          </button>
        )}
      </div>

      {!phoneSubmitted && (
        <form onSubmit={logIn} className="space-y-4 max-w-sm">
          <label className="block text-sm font-medium">
            מספר הטלפון שאיתו פתחת את ההזמנה
          </label>
          <input
            type="tel"
            inputMode="tel"
            placeholder="0501234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            dir="ltr"
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-lg outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900"
            required
          />
          <button
            type="submit"
            disabled={busy || phone.length < 9}
            className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
          >
            {busy ? "טוען..." : "כניסה"}
          </button>
          <p className="text-xs text-zinc-500">
            במצב הבדיקה הנוכחי לא נדרש קוד אימות. בעתיד תקבל/י קוד בוואטסאפ.
          </p>
        </form>
      )}

      {phoneSubmitted && (
        <div className="space-y-10">
          {/* WhatsApp CTA — primary action, same as /start */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">להזמין מדבקה חדשה</h2>
            <a
              href={waLink}
              target="_blank"
              rel="noopener"
              className="block rounded-2xl border-2 border-emerald-300 bg-emerald-50/40 p-6 text-center transition hover:border-emerald-500 hover:bg-emerald-50 dark:border-emerald-700/60 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40"
            >
              <div className="text-4xl">📱</div>
              <div className="mt-2 text-base font-bold">פתחו וואטסאפ</div>
              {formattedServicePhone && (
                <div
                  className="mt-1 font-mono text-sm text-zinc-700 dark:text-zinc-200"
                  dir="ltr"
                >
                  {formattedServicePhone}
                </div>
              )}
              <div className="mt-2 text-xs text-zinc-500">
                שלחו את הסטיקר ממספר הטלפון הזה. ברגע שיגיע — נמשיך אוטומטית
                לעמוד ההזמנה.
              </div>
            </a>
            <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              ממתין לסטיקר...
            </div>
          </section>

          {/* Past orders */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">
              או הזמינו שוב מדבקה שכבר ביקשתם
            </h2>
            <p className="text-xs text-zinc-500">
              <span dir="ltr">
                +
                {phone.startsWith("0") ? "972" + phone.slice(1) : phone}
              </span>{" "}
              · {orders?.length ?? 0}{" "}
              {(orders?.length ?? 0) === 1 ? "הזמנה" : "הזמנות"}
            </p>

            {orders && orders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
                אין עדיין הזמנות במספר הזה. שלחו את התמונה הראשונה בוואטסאפ.
              </div>
            ) : (
              <ul className="space-y-3">
                {orders?.map((o) => {
                  const productType = isProductType(o.productType)
                    ? o.productType
                    : "sticker";
                  const variant = variantFor(productType, o.size);
                  return (
                    <li
                      key={o.id}
                      className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      {o.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={o.thumbUrl}
                          alt=""
                          className="h-16 w-16 rounded-md object-cover"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-md bg-zinc-200 dark:bg-zinc-800" />
                      )}
                      <div className="flex-1 text-right">
                        <div className="text-sm font-bold">
                          {PRODUCT_LABELS_HE[productType]}
                          {variant ? ` · ${variant.labelHe}` : ` · ${o.size}`}{" "}
                          · ×{o.quantity}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {new Date(o.createdAt).toLocaleString("he-IL")} ·{" "}
                          {formatIls(o.totalAgorot)}
                        </div>
                        <div className="mt-1 text-[10px] text-zinc-500">
                          {o.fulfillmentId
                            ? `Prodigi ${o.fulfillmentStatus ?? "submitted"}`
                            : o.paidAt
                              ? "שולם · ממתין להגשה"
                              : "טיוטה"}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Link
                          href={`/order/${o.id}`}
                          className="rounded-full border border-zinc-300 px-3 py-1 text-xs hover:border-zinc-500 dark:border-zinc-700"
                        >
                          פרטים
                        </Link>
                        <button
                          onClick={() => reorder(o.id)}
                          disabled={busy}
                          className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
                        >
                          הזמן שוב
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {err && (
            <pre className="rounded-md bg-red-50 p-3 text-xs text-red-900 dark:bg-red-950/40 dark:text-red-200">
              {err}
            </pre>
          )}
        </div>
      )}
    </main>
  );
}
