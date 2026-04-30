"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { STICKER_VARIANTS, isStickerSize } from "@/lib/prodigi-catalog";
import { formatIls } from "@/lib/pricing";

type OrderView = {
  id: string;
  size: string;
  quantity: number;
  totalAgorot: number;
  paidAt: string | null;
  fulfillmentId: string | null;
  fulfillmentStatus: string | null;
  createdAt: string;
  thumbUrl: string | null;
};

export default function AccountPage() {
  const [phone, setPhone] = useState("");
  const [phoneSubmitted, setPhoneSubmitted] = useState(false);
  const [orders, setOrders] = useState<OrderView[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function loadOrders(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/account/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(j.error ?? `HTTP ${res.status}`);
        return;
      }
      setOrders(j.orders);
      setPhoneSubmitted(true);
    } finally {
      setBusy(false);
    }
  }

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

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <h1 className="mb-8 text-3xl font-bold">ההזמנות שלי</h1>

      {!phoneSubmitted && (
        <form onSubmit={loadOrders} className="space-y-4 max-w-sm">
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
            {busy ? "טוען..." : "הצג הזמנות"}
          </button>
          <p className="text-xs text-zinc-500">
            במצב הבדיקה הנוכחי לא נדרש קוד אימות. בעתיד תקבל/י קוד בוואטסאפ.
          </p>
        </form>
      )}

      {phoneSubmitted && orders && (
        <>
          <p className="mb-4 text-sm text-zinc-500">
            <span dir="ltr">+{phone.startsWith("0") ? "972" + phone.slice(1) : phone}</span>{" "}
            · {orders.length} {orders.length === 1 ? "הזמנה" : "הזמנות"}
          </p>

          {orders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-900">
              <p className="mb-4 text-zinc-500">לא נמצאו הזמנות עבור מספר זה.</p>
              <Link
                href="/"
                className="inline-flex h-10 items-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
              >
                להזמין מדבקה ראשונה
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {orders.map((o) => {
                const variant = isStickerSize(o.size)
                  ? STICKER_VARIANTS[o.size]
                  : null;
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
                        {variant?.labelHe ?? o.size} · ×{o.quantity}
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

          {err && (
            <pre className="mt-4 rounded-md bg-red-50 p-3 text-xs text-red-900 dark:bg-red-950/40 dark:text-red-200">
              {err}
            </pre>
          )}
        </>
      )}
    </main>
  );
}
