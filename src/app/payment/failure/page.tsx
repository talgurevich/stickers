import Link from "next/link";

export default function PaymentFailurePage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md space-y-4 text-center">
        <div className="text-5xl">×</div>
        <h1 className="text-2xl font-bold text-red-600 dark:text-red-400">
          התשלום לא הושלם
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          זוהי בדיקת חיבור בלבד. אם הגעת לכאן, ה־flow מ־PayPlus חזר עם כשלון
          (אפשרי גם בעת ביטול ידני).
        </p>
        <Link className="text-sm underline" href="/">
          חזרה לדף הבית
        </Link>
      </div>
    </main>
  );
}
