// Client-side cart store, persisted in localStorage.
//
// Each line item references a session (which owns the image in storage) plus
// the buyer's chosen size + quantity. The image path is duplicated into the
// line item so checkout can post images directly without depending on the
// session row still being live (sessions expire 60 min after creation).

"use client";

import { useSyncExternalStore } from "react";
import type { StickerSize } from "./prodigi-catalog";

const STORAGE_KEY = "wallaura.cart.v1";

export type CartItem = {
  sessionId: string;
  /** Bucket-relative path; survives session expiry. */
  imagePath: string;
  /** Signed URL captured at add-time; for display only, may go stale. */
  imageUrl: string | null;
  size: StickerSize;
  quantity: number;
  addedAt: string;
};

type Cart = { items: CartItem[] };

const EMPTY: Cart = { items: [] };

function read(): Cart {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Cart;
    if (!parsed || !Array.isArray(parsed.items)) return EMPTY;
    return parsed;
  } catch {
    return EMPTY;
  }
}

function write(c: Cart) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  // Notify same-tab subscribers — `storage` event only fires across tabs.
  window.dispatchEvent(new CustomEvent("wallaura-cart-changed"));
}

const subscribe = (cb: () => void) => {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };
  const onLocal = () => cb();
  window.addEventListener("storage", onStorage);
  window.addEventListener("wallaura-cart-changed", onLocal);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("wallaura-cart-changed", onLocal);
  };
};

const getSnapshot = (): Cart => read();
const getServerSnapshot = (): Cart => EMPTY;

export function useCart() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Cart count — hydration-safe (returns 0 on first render, then real value). */
export function useCartCount(): number {
  const cart = useCart();
  // Avoid the SSR/CSR mismatch warning by deferring to a useEffect-ish read.
  // useSyncExternalStore with a server snapshot of EMPTY already keeps the
  // first paint at 0; useCart's hydration kicks in on the next tick.
  return cart.items.reduce((n, i) => n + i.quantity, 0);
}

export function addItem(item: Omit<CartItem, "addedAt">) {
  const cart = read();
  // If a line for the same session already exists, replace it (user re-
  // configured the same image — a single sticker per session in cart).
  const next = cart.items.filter((i) => i.sessionId !== item.sessionId);
  next.push({ ...item, addedAt: new Date().toISOString() });
  write({ items: next });
}

export function updateQuantity(sessionId: string, quantity: number) {
  const q = Math.max(1, Math.min(50, Math.round(quantity)));
  const cart = read();
  write({
    items: cart.items.map((i) =>
      i.sessionId === sessionId ? { ...i, quantity: q } : i,
    ),
  });
}

export function removeItem(sessionId: string) {
  const cart = read();
  write({ items: cart.items.filter((i) => i.sessionId !== sessionId) });
}

export function clearCart() {
  write(EMPTY);
}

/** True only after first client-side render — for SSR-safe conditional UI. */
export function useHasMounted(): boolean {
  return useSyncExternalStore(
    // Subscribe is called after mount; the snapshot flips from false → true
    // implicitly because getServerSnapshot returns false but getSnapshot
    // returns true on the client.
    () => () => {},
    () => true,
    () => false,
  );
}
