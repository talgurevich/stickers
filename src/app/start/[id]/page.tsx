"use client";

import { useCallback, useEffect, useState, use } from "react";
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

type InboxItem =
  | {
      kind: "session";
      sessionId: string;
      imagePath: string;
      imageUrl: string | null;
      receivedAt: string | null;
    }
  | {
      kind: "orphan";
      orphanId: string;
      imagePath: string;
      imageUrl: string | null;
      receivedAt: string;
    };

// Poll the inbox every few seconds to surface orphan stickers as they
// land. Realtime covers the FIRST image attaching to the session, but
// subsequent inbound stickers go to whatsapp_orphans (which isn't on the
// realtime publication), so we fall back to polling for the gallery.
const INBOX_POLL_MS = 4000;

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
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [claiming, setClaiming] = useState(false);

  const refreshInbox = useCallback(async () => {
    try {
      const r = await fetch(`/api/sessions/${id}/inbox`, { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { items: InboxItem[] };
      setInbox(j.items ?? []);
    } catch {
      /* non-fatal — next poll will retry */
    }
  }, [id]);

  // Initial fetch — session row, past orders, and inbox in parallel.
  // setState lives inside the .then continuations and refreshInbox, both of
  // which are unavoidable for the "load on mount" shape.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let alive = true;
    fetch(`/api/sessions/${id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(async (j: SessionView | null) => {
        if (!alive || !j) return;
        setSession(j);
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
    refreshInbox();
    return () => {
      alive = false;
    };
  }, [id, refreshInbox]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Realtime — when the WhatsApp ingest writes image_url onto THIS
  // session, refresh the inbox (don't auto-redirect anymore: the user
  // might still be expecting more stickers and the gallery shows them).
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
        () => {
          refreshInbox();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, refreshInbox]);

  // Poll the inbox for orphan stickers. whatsapp_orphans isn't on the
  // realtime publication so polling is the cheapest way to catch them.
  useEffect(() => {
    const t = setInterval(refreshInbox, INBOX_POLL_MS);
    return () => clearInterval(t);
  }, [refreshInbox]);

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

  async function pickImage(item: InboxItem) {
    if (claiming) return;
    if (item.kind === "session") {
      router.push(`/configure/${item.sessionId}`);
      return;
    }
    if (!session) return;
    setClaiming(true);
    try {
      const res = await fetch(`/api/orphans/${item.orphanId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: session.phone }),
      });
      const j = await res.json();
      if (res.ok && j.sessionId) {
        router.push(`/configure/${j.sessionId}`);
      }
    } finally {
      setClaiming(false);
    }
  }

  const servicePhone = process.env.NEXT_PUBLIC_SERVICE_PHONE;
  const formattedPhone = servicePhone
    ? `+${servicePhone.replace(/(\d{3})(\d{2})(\d{3})(\d{4})/, "$1 $2 $3 $4")}`
    : null;
  const waLink = servicePhone ? `https://wa.me/${servicePhone}` : "#";

  const hasInbox = inbox.length > 0;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">
            {hasInbox ? "בחרו סטיקר להדפסה" : "שלחו לנו את הסטיקר"}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {hasInbox
              ? "כל הסטיקרים ששלחת הופיעו כאן. הקליקו על אחד כדי להמשיך, או שלחו עוד בוואטסאפ."
              : "פותחים וואטסאפ ושולחים את הסטיקר למספר השירות. אפשר לשלוח כמה סטיקרים — כולם יופיעו כאן."}
          </p>
        </div>

        {hasInbox && (
          <div>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {inbox.map((item) => {
                const key =
                  item.kind === "session"
                    ? `s:${item.sessionId}`
                    : `o:${item.orphanId}`;
                return (
                  <li key={key}>
                    <button
                      onClick={() => pickImage(item)}
                      disabled={claiming}
                      className="group relative flex w-full flex-col items-center gap-1 rounded-lg border-2 border-zinc-200 bg-white p-2 transition hover:border-emerald-500 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="aspect-square w-full rounded object-cover"
                        />
                      ) : (
                        <div className="aspect-square w-full rounded bg-zinc-100 dark:bg-zinc-800" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <a
          href={waLink}
          target="_blank"
          rel="noopener"
          className="block rounded-2xl border-2 border-emerald-300 bg-emerald-50/40 p-6 transition hover:border-emerald-500 hover:bg-emerald-50 dark:border-emerald-700/60 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40"
        >
          <div className="text-4xl">📱</div>
          <div className="mt-2 text-base font-bold">
            {hasInbox ? "לשלוח עוד סטיקר" : "פתחו וואטסאפ"}
          </div>
          {formattedPhone && (
            <div
              className="mt-1 font-mono text-sm text-zinc-700 dark:text-zinc-200"
              dir="ltr"
            >
              {formattedPhone}
            </div>
          )}
          <div className="mt-2 text-xs text-zinc-500">
            שלחו את הסטיקר ממספר הטלפון שאיתו פתחתם את ההזמנה.
          </div>
        </a>

        {!hasInbox && (
          <div className="flex items-center justify-center gap-2 text-sm text-zinc-500">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            ממתין לסטיקר...
          </div>
        )}

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
