"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl space-y-10 text-center">
        <span className="inline-flex items-center rounded-full border border-zinc-300 bg-white/60 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
          MVP · בבנייה
        </span>

        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            המדבקות מהוואטסאפ שלך,{" "}
            <span className="text-emerald-600 dark:text-emerald-400">
              מודפסות אצלך בבית
            </span>
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-300">
            שולחים סטיקר מהוואטסאפ או מעלים תמונה, בוחרים גודל וכמות, ומקבלים
            מדבקות אמיתיות עד הבית.
          </p>
        </div>

        <form
          onSubmit={start}
          className="mx-auto flex w-full max-w-sm flex-col gap-3 text-right"
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
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-lg text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            dir="ltr"
            required
          />
          {err && (
            <p className="text-sm text-red-600 dark:text-red-400">{err}</p>
          )}
          <button
            type="submit"
            disabled={busy || phone.length < 9}
            className="mt-2 inline-flex h-12 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {busy ? "ממתין..." : "להתחיל"}
          </button>
          <p className="text-xs text-zinc-500">
            לא נשלח לך הודעה עד שתבחר/י לעשות זאת.
          </p>
        </form>
      </div>
    </main>
  );
}
