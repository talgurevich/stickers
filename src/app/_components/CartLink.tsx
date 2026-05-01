"use client";

import Link from "next/link";
import { useCart, useHasMounted } from "@/lib/cart";

export default function CartLink() {
  const cart = useCart();
  const mounted = useHasMounted();
  const count = mounted ? cart.items.reduce((n, i) => n + i.quantity, 0) : 0;

  return (
    <Link
      href="/cart"
      className="relative inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
      aria-label={`הסל (${count} פריטים)`}
    >
      <span>הסל</span>
      {count > 0 && (
        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-bold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
