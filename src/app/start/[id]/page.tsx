"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase-browser";
import {
  PRODUCT_LABELS_HE,
  isProductType,
  variantFor,
} from "@/lib/prodigi-catalog";

type SessionView = {
  id: string;
  phone: string;
  status: string;
  imageUrl?: string | null;
};

type PastOrder = {
  id: string;
  productType: string;
  size: string;
  quantity: number;
  thumbUrl: string | null;
  createdAt: string;
};

export default function StartPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionView | null>(null);
  const [pastOrders, setPastOrders] = useState<PastOrder[]>([]);
  const [reordering, setReordering] = useState<string | null>(null);

  // Initial fetch — covers the case where the orphan sweep at session
  // create already attached an image, so we redirect immediately. Also
  // pulls past orders for this phone so a returning user sees their
  // previous stickers.
  useEffect(() => {
    let alive = true;
    fetch(`/api/sessions/${id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(async (j: SessionView | null) => {
        if (!alive || !j) return;
        setSession(j);
        if (j.imageUrl) {
          router.push(`/configure/${id}`);
          return;
        }
        // Fetch past orders for this phone in parallel.
        try {
          const res = await fetch("/api/account/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: j.phone }),
          });
          if (res.ok) {
            const acc = await res.json();
            if (alive) {
              setPastOrders(
                (acc.orders ?? []).map(
                  (o: {
                    id: string;
                    productType?: string;
                    size: string;
                    quantity: number;
                    thumbUrl: string | null;
                    createdAt: string;
                  }) => ({
                    id: o.id,
                    productType: o.productType ?? "sticker",
                    size: o.size,
                    quantity: o.quantity,
                    thumbUrl: o.thumbUrl,
                    createdAt: o.createdAt,
                  }),
                ),
              );
            }
          }
        } catch {
          /* non-fatal */
        }
      });
    return () => {
      alive = false;
    };
  }, [id, router]);

  async function reorder(orderId: string) {
    if (!session) return;
    setReordering(orderId);
    try {
      const res = await fetch("/api/account/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, phone: session.phone }),
      });
      const j = await res.json();
      if (res.ok) router.push(`/configure/${j.sessionId}`);
    } finally {
      setReordering(null);
    }
  }

  // Realtime subscription — when the WhatsApp ingest writes image_url,
  // we move on without polling.
  useEffect(() => {
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`session:${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const next = payload.new as { image_url?: string | null };
          if (next?.image_url) {
            router.push(`/configure/${id}`);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, router]);

  const servicePhone = process.env.NEXT_PUBLIC_SERVICE_PHONE;
  const formattedPhone = servicePhone
    ? `+${servicePhone.replace(/(\d{3})(\d{2})(\d{3})(\d{4})/, "$1 $2 $3 $4")}`
    : null;
  const waLink = servicePhone
    ? `https://wa.me/${servicePhone}?text=${encodeURIComponent("מצרפ.ת תמונה")}`
    : "#";

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">שלחו לנו את התמונה</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            פותחים וואטסאפ ושולחים סטיקר או תמונה למספר השירות. ברגע שיגיע —
            תוכלו לבחור מה להדפיס: מדבקה, מגנט, או קעקוע זמני.
          </p>
        </div>

        <a
          href={waLink}
          target="_blank"
          rel="noopener"
          className="block rounded-2xl border-2 border-emerald-300 bg-emerald-50/40 p-8 transition hover:border-emerald-500 hover:bg-emerald-50 dark:border-emerald-700/60 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40"
        >
          <div className="text-5xl">📱</div>
          <div className="mt-3 text-lg font-bold">פתחו וואטסאפ</div>
          {formattedPhone && (
            <div
              className="mt-2 font-mono text-base text-zinc-700 dark:text-zinc-200"
              dir="ltr"
            >
              {formattedPhone}
            </div>
          )}
          <div className="mt-3 text-xs text-zinc-500">
            שלחו את התמונה ממספר הטלפון שאיתו פתחתם את ההזמנה.
          </div>
        </a>

        <div className="flex items-center justify-center gap-2 text-sm text-zinc-500">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          ממתין לתמונה...
        </div>

        <p className="text-xs text-zinc-500">
          טלפון שאיתו פתחת את ההזמנה: <span dir="ltr">+{session?.phone}</span>
        </p>

        {pastOrders.length > 0 && (
          <div className="space-y-3 border-t border-zinc-200 pt-8 text-right dark:border-zinc-800">
            <h2 className="text-base font-semibold">
              או בחרו פריט שכבר הזמנתם
            </h2>
            <p className="text-xs text-zinc-500">
              מצאנו {pastOrders.length} הזמנות קודמות מהטלפון הזה. הקליקו על
              אחת כדי להזמין שוב.
            </p>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {pastOrders.map((o) => {
                const productType = isProductType(o.productType)
                  ? o.productType
                  : "sticker";
                const variant = variantFor(productType, o.size);
                return (
                  <li key={o.id}>
                    <button
                      onClick={() => reorder(o.id)}
                      disabled={reordering !== null}
                      className="group flex w-full flex-col items-center gap-1 rounded-lg border border-zinc-200 bg-white p-2 transition hover:border-emerald-500 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      {o.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={o.thumbUrl}
                          alt=""
                          className="aspect-square w-full rounded object-cover"
                        />
                      ) : (
                        <div className="aspect-square w-full rounded bg-zinc-100 dark:bg-zinc-800" />
                      )}
                      <span className="truncate text-[10px] text-zinc-500">
                        {PRODUCT_LABELS_HE[productType]}
                        {variant ? ` · ${variant.labelHe.split(" · ")[0]}` : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
