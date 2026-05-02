// Client-side cart store, persisted in localStorage.
//
// Each line item references a session (which owns the image in storage) plus
// the buyer's chosen product type, size, and quantity. The image path is
// duplicated into the line item so checkout can post images directly
// without depending on the session row still being live (sessions expire
// 60 min after creation).

"use client";

import { useSyncExternalStore } from "react";
import type { ProductType } from "./prodigi-catalog";

// v2: added productType per line. v1 (sticker-only) carts are dropped on
// load — small UX cost, avoids brittle migration of stale carts.
const STORAGE_KEY = "wallaura.cart.v2";

export type CartItem = {
  sessionId: string;
  /** Bucket-relative path; survives session expiry. */
  imagePath: string;
  /** Signed URL captured at add-time; for display only, may go stale. */
  imageUrl: string | null;
  productType: ProductType;
  /** Size string, interpreted in context of productType. */
  size: string;
  quantity: number;
  addedAt: string;
};

type Cart = { items: CartItem[] };

const EMPTY: Cart = { items: [] };

function readFromStorage(): Cart {
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

// Cached snapshot — useSyncExternalStore's getSnapshot must return a
// referentially stable value when nothing changed; returning a fresh object
// every call trips React 19's infinite-loop guard and crashes the tree.
let cachedSnapshot: Cart | null = null;
function refreshSnapshot() {
  cachedSnapshot = readFromStorage();
}

function write(c: Cart) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  cachedSnapshot = c;
  // Notify same-tab subscribers — `storage` event only fires across tabs.
  window.dispatchEvent(new CustomEvent("wallaura-cart-changed"));
}

const subscribe = (cb: () => void) => {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      refreshSnapshot();
      cb();
    }
  };
  const onLocal = () => cb();
  window.addEventListener("storage", onStorage);
  window.addEventListener("wallaura-cart-changed", onLocal);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("wallaura-cart-changed", onLocal);
  };
};

const getSnapshot = (): Cart => {
  if (cachedSnapshot === null) refreshSnapshot();
  return cachedSnapshot ?? EMPTY;
};
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
  const cart = readFromStorage();
  // Dedup key is (sessionId, productType): the same image can live in the
  // cart as both a sticker AND a magnet, but re-configuring the same
  // (image, product) replaces the prior line.
  const next = cart.items.filter(
    (i) =>
      !(i.sessionId === item.sessionId && i.productType === item.productType),
  );
  next.push({ ...item, addedAt: new Date().toISOString() });
  write({ items: next });
}

export function updateQuantity(
  sessionId: string,
  productType: ProductType,
  quantity: number,
) {
  const q = Math.max(1, Math.min(50, Math.round(quantity)));
  const cart = readFromStorage();
  write({
    items: cart.items.map((i) =>
      i.sessionId === sessionId && i.productType === productType
        ? { ...i, quantity: q }
        : i,
    ),
  });
}

export function removeItem(sessionId: string, productType: ProductType) {
  const cart = readFromStorage();
  write({
    items: cart.items.filter(
      (i) => !(i.sessionId === sessionId && i.productType === productType),
    ),
  });
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
