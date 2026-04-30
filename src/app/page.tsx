"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RecentFeed from "./_components/RecentFeed";

const HERO_IMAGE_URL =
  "https://images.unsplash.com/photo-1572950947476-26a6e4111e80?fm=jpg&q=70&w=2400&auto=format&fit=crop";

export default function Home() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(
          json.error === "invalid-phone"
            ? "מספר הטלפון לא תקין — דוגמה: 0501234567"
            : json.error ?? "אירעה שגיאה",
        );
        return;
      }
      router.push(`/start/${json.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className="relative flex flex-1 items-center justify-center px-6 py-16"
      style={{
        backgroundImage: `url('${HERO_IMAGE_URL}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Darken overlay so text on the busy sticker photo stays legible. */}
      <div className="absolute inset-0 bg-zinc-950/55" aria-hidden />

      <div className="relative z-10 w-full max-w-xl space-y-8 text-center">
        <span className="inline-flex items-center rounded-full border border-white/40 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
          MVP · בבנייה
        </span>

        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-lg sm:text-5xl">
            המדבקות מהוואטסאפ שלך,{" "}
            <span className="text-emerald-300">מודפסות אצלך בבית</span>
          </h1>
          <p className="text-lg text-zinc-100/95 drop-shadow">
            שולחים סטיקר מהוואטסאפ או בוחרים מהמדבקות הקודמות שלכם, מקבלים
            מדבקות אמיתיות עד הבית.
          </p>
        </div>

        <form
          onSubmit={start}
          className="mx-auto flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-white/30 bg-white/95 p-6 text-right shadow-2xl backdrop-blur-md dark:bg-zinc-900/90"
        >
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            מספר הטלפון שלך
          </label>
          <input
            type="tel"
            inputMode="tel"
            placeholder="0501234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-lg text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            dir="ltr"
            required
          />
          {err && (
            <p className="text-sm text-red-600 dark:text-red-400">{err}</p>
          )}
          <button
            type="submit"
            disabled={busy || phone.length < 9}
            className="mt-2 inline-flex h-12 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-medium text-white shadow-lg transition-colors hover:bg-emerald-700 disabled:opacity-40"
          >
            {busy ? "ממתין..." : "להתחיל"}
          </button>
          <p className="text-xs text-zinc-500">
            לא נשלח לך הודעה עד שתבחר/י לעשות זאת.
          </p>
        </form>

        <div className="text-xs text-zinc-100/90">
          כבר הזמנתם בעבר?{" "}
          <a href="/account" className="underline">
            לכניסה לחשבון
          </a>
        </div>

        <RecentFeed />
      </div>
    </main>
  );
}
