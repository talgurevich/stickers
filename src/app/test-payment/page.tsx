"use client";

import { useState } from "react";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; link: string };

export default function TestPaymentPage() {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function start() {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/checkout/test", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setState({ kind: "error", message: json.error ?? `HTTP ${res.status}` });
        return;
      }
      setState({ kind: "ready", link: json.paymentPageLink });
      window.location.href = json.paymentPageLink;
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="text-2xl font-bold">בדיקת תשלום ב־₪1</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          מטרה: לוודא שחיבור ה־PayPlus עובד מקצה לקצה. לחיצה תיצור דף תשלום
          ותעביר אותך אליו.
        </p>

        <button
          onClick={start}
          disabled={state.kind === "loading"}
          className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {state.kind === "loading" ? "יוצר דף תשלום..." : "התחל תשלום"}
        </button>

        {state.kind === "error" && (
          <pre className="rounded-md bg-red-50 p-3 text-left text-xs text-red-900 whitespace-pre-wrap dark:bg-red-950/40 dark:text-red-200">
            {state.message}
          </pre>
        )}
        {state.kind === "ready" && (
          <p className="text-xs text-zinc-500">
            מעביר אותך ל־
            <a className="underline" href={state.link}>
              {state.link}
            </a>
          </p>
        )}
      </div>
    </main>
  );
}
