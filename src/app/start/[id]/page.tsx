"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase-browser";

type SessionView = {
  id: string;
  phone: string;
  status: string;
  imageUrl?: string | null;
};

export default function StartPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionView | null>(null);

  // Initial fetch — covers the case where the orphan sweep at session
  // create already attached an image, so we redirect immediately.
  useEffect(() => {
    let alive = true;
    fetch(`/api/sessions/${id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: SessionView | null) => {
        if (!alive || !j) return;
        setSession(j);
        if (j.imageUrl) router.push(`/configure/${id}`);
      });
    return () => {
      alive = false;
    };
  }, [id, router]);

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
    ? `https://wa.me/${servicePhone}?text=${encodeURIComponent("מצרפ.ת מדבקה")}`
    : "#";

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">שלחו לנו את הסטיקר</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            פותחים וואטסאפ ושולחים את הסטיקר למספר השירות. ברגע שיגיע — נמשיך
            אוטומטית.
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
            שלחו את הסטיקר ממספר הטלפון שאיתו פתחתם את ההזמנה.
          </div>
        </a>

        <div className="flex items-center justify-center gap-2 text-sm text-zinc-500">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          ממתין לסטיקר...
        </div>

        <p className="text-xs text-zinc-500">
          טלפון שאיתו פתחת את ההזמנה: <span dir="ltr">+{session?.phone}</span>
        </p>
      </div>
    </main>
  );
}
