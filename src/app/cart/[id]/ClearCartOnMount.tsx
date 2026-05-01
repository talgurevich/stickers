"use client";

import { useEffect } from "react";
import { clearCart } from "@/lib/cart";

// Successful checkout completed — drop the local cart so the user doesn't
// see the just-purchased items again next time they hit /cart.
export default function ClearCartOnMount() {
  useEffect(() => {
    clearCart();
  }, []);
  return null;
}
