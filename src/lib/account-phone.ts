// Persisted phone number, shared by /account and the homepage so a returning
// user doesn't have to re-type the number on every navigation. The phone
// itself isn't sensitive — it's the id we use everywhere — but the storage
// helpers are tolerant of quota / private-mode failures so we never throw
// on read or write.

"use client";

const STORAGE_KEY = "wallaura.account.phone.v1";

export function getStoredPhone(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredPhone(phone: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, phone);
  } catch {
    /* private-mode etc. */
  }
}

export function clearStoredPhone(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* no-op */
  }
}

/** Pretty-print for display. Accepts whatever format was stored. */
export function formatStoredPhone(p: string): string {
  const digits = p.replace(/\D/g, "");
  if (digits.startsWith("972") && digits.length === 12) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 5)}-${digits.slice(5, 8)}-${digits.slice(8)}`;
  }
  if (digits.startsWith("0") && digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return p;
}
