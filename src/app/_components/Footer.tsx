"use client";

import { useState } from "react";

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

export default function Footer() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, email }),
      });
      const j = await res.json();
      if (!res.ok) {
        setState({ kind: "error", message: j.error ?? `HTTP ${res.status}` });
        return;
      }
      setState({ kind: "sent" });
      setMessage("");
      setEmail("");
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <footer className="mt-auto border-t border-zinc-200 bg-white/60 px-6 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 text-xs">
          <div>
            נבנה על פטריות ב־
            <a
              href="https://errn.io"
              target="_blank"
              rel="noopener"
              className="underline hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              errn.io
            </a>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            <a
              href="/legal/terms"
              className="underline hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Terms of Service
            </a>
            <span aria-hidden>·</span>
            <a
              href="/legal/privacy"
              className="underline hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Privacy Policy
            </a>
          </div>
          <div className="text-[10px] text-zinc-400 dark:text-zinc-600">
            תמונת רקע:{" "}
            <a
              href="https://unsplash.com/@darya_tryfanava"
              target="_blank"
              rel="noopener"
              className="underline hover:text-zinc-600"
            >
              Darya Tryfanava
            </a>{" "}
            ב־
            <a
              href="https://unsplash.com/photos/9Z_VwmBVYNY"
              target="_blank"
              rel="noopener"
              className="underline hover:text-zinc-600"
            >
              Unsplash
            </a>
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          {!open && state.kind !== "sent" ? (
            <button
              onClick={() => setOpen(true)}
              className="text-xs underline hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              שליחת משוב
            </button>
          ) : state.kind === "sent" ? (
            <p className="text-xs text-emerald-600">תודה! המשוב התקבל.</p>
          ) : (
            <form
              onSubmit={submit}
              className="w-full max-w-xs space-y-2 text-right"
            >
              <textarea
                placeholder="מה דעתך? תקלה? רעיון?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <input
                type="email"
                placeholder="אימייל לחזרה (אופציונלי)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 placeholder-zinc-400 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                dir="ltr"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setState({ kind: "idle" });
                  }}
                  className="px-2 py-1 text-xs text-zinc-500"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={!message.trim() || state.kind === "sending"}
                  className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
                >
                  {state.kind === "sending" ? "שולח..." : "שליחה"}
                </button>
              </div>
              {state.kind === "error" && (
                <p className="text-xs text-red-600">{state.message}</p>
              )}
            </form>
          )}
        </div>
      </div>
    </footer>
  );
}
