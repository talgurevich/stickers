import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl space-y-8 text-center">
        <span className="inline-flex items-center rounded-full border border-zinc-300 bg-white/60 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
          MVP · בבנייה
        </span>

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

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/test-payment"
            className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            בדיקת תשלום ב־₪1
          </Link>
          <span className="text-xs text-zinc-500">
            (משמש לאימות חיבור PayPlus)
          </span>
        </div>
      </div>
    </main>
  );
}
