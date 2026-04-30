"use client";

import { useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";

type SessionView = {
  id: string;
  phone: string;
  status: string;
  imageUrl?: string;
};

export default function StartPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionView | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Poll for image arrival (until Supabase realtime is wired).
  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const res = await fetch(`/api/sessions/${id}`, { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as SessionView;
        if (!alive) return;
        setSession(j);
        if (j.imageUrl) {
          router.push(`/configure/${id}`);
        }
      } catch {
        // swallow — we'll try again
      }
    }
    tick();
    const t = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id, router]);

  async function onFile(file: File) {
    setUploading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch(`/api/sessions/${id}/upload`, {
        method: "POST",
        body: fd,
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(j.error ?? `שגיאה ${res.status}`);
        return;
      }
      router.push(`/configure/${id}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl space-y-8 text-center">
        <h1 className="text-3xl font-bold">איך נקבל את המדבקה?</h1>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Upload */}
          <button
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="group flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-zinc-300 bg-white p-6 text-center transition hover:border-emerald-400 hover:bg-emerald-50/40 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-emerald-500/60 dark:hover:bg-emerald-950/20"
          >
            <div className="text-4xl">⬆</div>
            <div className="font-semibold">העלאת קובץ</div>
            <div className="text-xs text-zinc-500">
              PNG / JPG / WebP / GIF · עד 8MB
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
          </button>

          {/* WhatsApp — disabled until service number is configured */}
          <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 p-6 text-center opacity-60 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="text-4xl">📱</div>
            <div className="font-semibold">שליחה בוואטסאפ</div>
            <div className="text-xs text-zinc-500">
              בקרוב — ממתין להגדרת מספר השירות
            </div>
          </div>
        </div>

        {uploading && (
          <p className="text-sm text-zinc-500">מעלה ומעבד את התמונה...</p>
        )}
        {err && <p className="text-sm text-red-600">{err}</p>}

        <p className="text-xs text-zinc-500">
          טלפון שאיתו פתחת את ההזמנה: <span dir="ltr">+{session?.phone}</span>
        </p>
      </div>
    </main>
  );
}
