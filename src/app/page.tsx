"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import RecentFeed from "./_components/RecentFeed";
import {
  clearStoredPhone,
  formatStoredPhone,
  getStoredPhone,
  setStoredPhone,
} from "@/lib/account-phone";

const HERO_IMAGE_URL =
  "https://images.unsplash.com/photo-1572950947476-26a6e4111e80?fm=jpg&q=70&w=2400&auto=format&fit=crop";

// Satirical "testimonials" — none of these people exist. Tone is whimsical
// and self-aware; they punch up the cultural absurdity of WhatsApp stickers
// becoming physical objects.
const TESTIMONIALS: { quote: string; byline: string }[] = [
  {
    quote:
      "קניתי 20 מדבקות של החתול שלי. הוא לא יודע. כנראה לא ידע לעולם. אני אדם מאושר יותר.",
    byline: "מיכל, 34, ראשון לציון",
  },
  {
    quote:
      "חשבתי שזה רעיון מטופש. הוא באמת מטופש. הזמנתי בכל זאת. אני שמח שהזמנתי. אני מבולבל.",
    byline: "עופר, 45, חיפה",
  },
  {
    quote:
      "אמא שלי שלחה לי בוואטסאפ סטיקר של עצמה אוכלת חומוס. עכשיו זה קעקוע זמני על היד שלי. אני בן 32.",
    byline: "יותם, ירושלים",
  },
  {
    quote:
      "כמומחה לתחום הדבק, אני מאשר: איכות יוצאת דופן ביחס לקטגוריה.",
    byline: "ד״ר דן ברק (תואר לא קיים)",
  },
  {
    quote:
      "זה עבד. המדבקה הגיעה. דבקה לקיר. אני לא יודע מה אתם רוצים שאומר.",
    byline: "רן, מהנדס",
  },
];

export default function Home() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // null on SSR / first paint so we don't flash the empty form to a
  // returning user — both branches wait until hydrated is true.
  const [storedPhone, setStoredPhoneState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [forceFreshLogin, setForceFreshLogin] = useState(false);

  const startWith = useCallback(
    async (phoneToUse: string) => {
      setBusy(true);
      setErr(null);
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: phoneToUse }),
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
        // Persist whatever the user typed; server normalizes on POST so any
        // format works on the next read.
        setStoredPhone(phoneToUse);
        router.push(`/start/${json.id}`);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  // Hydration + auto-continue. The cart and configure pages link back here
  // with `?continue=1` after "add another item" — for a returning user we
  // skip the welcome-back screen and create a new session immediately.
  // setState-in-effect is the canonical SSR-safe shape for "read
  // localStorage on mount" — the alternatives (move to render, use
  // useSyncExternalStore) don't fit a one-shot async restore.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setHydrated(true);
    const stored = getStoredPhone();
    if (!stored) return;
    setStoredPhoneState(stored);
    setPhone(stored);
    const params = new URLSearchParams(window.location.search);
    if (params.get("continue") === "1") {
      startWith(stored);
    }
  }, [startWith]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function start(e: React.FormEvent) {
    e.preventDefault();
    await startWith(phone);
  }

  function useDifferentNumber() {
    clearStoredPhone();
    setStoredPhoneState(null);
    setPhone("");
    setForceFreshLogin(true);
  }

  const showWelcomeBack =
    hydrated && storedPhone !== null && !forceFreshLogin;

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
        <Image
          src="/logo.png"
          alt="Wallaura"
          width={529}
          height={172}
          priority
          className="mx-auto h-auto w-56 drop-shadow-2xl sm:w-72"
        />

        <span className="inline-flex items-center rounded-full border border-white/40 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
          MVP · בבנייה
        </span>

        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-lg sm:text-4xl">
            הסטיקר ההוא מהוואטסאפ?{" "}
            <span className="text-emerald-300">עכשיו על הקיר.</span>
          </h1>
          <p className="text-lg text-zinc-100/95 drop-shadow">
            שולחים בוואטסאפ. אנחנו מדפיסים. מקבלים הביתה. אין אפליקציה, אין עיצוב, אין סיבה לא.
          </p>
        </div>

        <ul className="grid grid-cols-3 gap-2 text-xs sm:gap-3 sm:text-sm">
          {[
            { he: "מדבקות", sub: "ויניל מט · עמיד למים" },
            { he: "מגנטים", sub: "למקרר · ללוח · לארון" },
            { he: "קעקוע זמני", sub: "לעור · 3-5 ימים" },
          ].map((p) => (
            <li
              key={p.he}
              className="rounded-xl border border-white/30 bg-white/10 px-2 py-3 text-white backdrop-blur-sm sm:px-3"
            >
              <div className="font-bold">{p.he}</div>
              <div className="mt-0.5 text-[11px] text-zinc-200/90 sm:text-xs">
                {p.sub}
              </div>
            </li>
          ))}
        </ul>

        {showWelcomeBack && storedPhone ? (
          <div className="mx-auto flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-white/30 bg-white/95 p-6 text-center shadow-2xl backdrop-blur-md dark:bg-zinc-900/90">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              ברוכים השבים
            </p>
            <p
              className="text-lg font-bold text-zinc-900 dark:text-zinc-50"
              dir="ltr"
            >
              {formatStoredPhone(storedPhone)}
            </p>
            {err && (
              <p className="text-sm text-red-600 dark:text-red-400">{err}</p>
            )}
            <button
              type="button"
              onClick={() => startWith(storedPhone)}
              disabled={busy}
              className="mt-2 inline-flex h-12 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-medium text-white shadow-lg transition-colors hover:bg-emerald-700 disabled:opacity-40"
            >
              {busy ? "ממתין..." : "התחלת הזמנה חדשה"}
            </button>
            <button
              type="button"
              onClick={useDifferentNumber}
              className="text-xs text-zinc-500 underline hover:text-zinc-900 dark:hover:text-white"
            >
              כניסה במספר אחר
            </button>
          </div>
        ) : (
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
        )}

        <div className="text-xs text-zinc-100/90">
          כבר הזמנתם בעבר?{" "}
          <a href="/account" className="underline">
            לכניסה לחשבון
          </a>
        </div>

        <section className="space-y-4 pt-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-200/80">
            המלצות לקוחות (כביכול)
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {TESTIMONIALS.map((t, i) => (
              <li
                key={i}
                className="rounded-xl border border-white/20 bg-white/10 p-4 text-right backdrop-blur-sm"
              >
                <p className="text-sm leading-relaxed text-white">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <p className="mt-2 text-[11px] text-zinc-300">— {t.byline}</p>
              </li>
            ))}
          </ul>
        </section>

        <RecentFeed />
      </div>
    </main>
  );
}
