// A dismissible banner shown only on viewports md+ (≥768px). Wallaura is
// designed mobile-first — this nudges desktop users toward the better
// experience without blocking them.
//
// Hidden on mobile via `hidden md:flex`. Dismissal is persisted to
// localStorage so the banner doesn't reappear on every page navigation
// after the user closes it.

"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "wallaura.mobile-notice-dismissed.v1";

export default function MobileFirstNotice() {
  const [hidden, setHidden] = useState(true);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") {
        return;
      }
    } catch {
      /* private mode etc. — assume not dismissed */
    }
    setHidden(false);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* no-op */
    }
    setHidden(true);
  }

  if (hidden) return null;

  return (
    <div className="hidden items-center justify-center gap-3 border-b border-emerald-300/30 bg-emerald-600/95 px-4 py-2 text-center text-sm text-white md:flex">
      <span>📱</span>
      <span>
        פססט… האתר הזה נולד בשביל הכיס שלך. אפשר להישאר כאן, אבל בנייד הוא ממש קורן.
      </span>
      <button
        onClick={dismiss}
        aria-label="סגירה"
        className="rounded-full px-2 text-white/80 transition hover:bg-white/15 hover:text-white"
      >
        ✕
      </button>
    </div>
  );
}
