// Coupon validation + atomic redemption. Reads use the anon-friendly path;
// redeem uses the SQL function redeem_coupon() so the increment is atomic
// (avoids two concurrent checkouts both passing the max_uses gate).

import { serverClient } from "./supabase";

export type CouponPreview = {
  code: string;
  discountPercent: number;
};

export type ValidateResult =
  | { ok: true; coupon: CouponPreview }
  | { ok: false; reason: "not-found" | "exhausted" | "inactive" | "expired" };

export async function validateCoupon(code: string): Promise<ValidateResult> {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, reason: "not-found" };

  const sb = serverClient();
  const { data } = await sb
    .from("coupons")
    .select("code, discount_percent, max_uses, used_count, active, expires_at")
    .ilike("code", trimmed)
    .maybeSingle();

  if (!data) return { ok: false, reason: "not-found" };
  if (!data.active) return { ok: false, reason: "inactive" };
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }
  if (data.used_count >= data.max_uses) return { ok: false, reason: "exhausted" };

  return {
    ok: true,
    coupon: {
      code: data.code,
      discountPercent: data.discount_percent,
    },
  };
}

export type RedeemResult =
  | { ok: true; coupon: CouponPreview }
  | { ok: false; reason: "not-found-or-exhausted" };

/**
 * Atomically increments used_count and returns the coupon, or fails if the
 * coupon doesn't exist / is exhausted / inactive / expired. Use this AT
 * checkout time — validateCoupon() is for previews only.
 */
export async function redeemCoupon(code: string): Promise<RedeemResult> {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, reason: "not-found-or-exhausted" };

  const { data, error } = await serverClient().rpc("redeem_coupon", {
    p_code: trimmed,
  });

  if (error || !data || (Array.isArray(data) && data.length === 0)) {
    return { ok: false, reason: "not-found-or-exhausted" };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    ok: true,
    coupon: {
      code: row.code as string,
      discountPercent: row.discount_percent as number,
    },
  };
}

export function applyDiscount(
  totalAgorot: number,
  discountPercent: number,
): { discountAgorot: number; finalAgorot: number } {
  const discountAgorot = Math.round((totalAgorot * discountPercent) / 100);
  return {
    discountAgorot,
    finalAgorot: Math.max(0, totalAgorot - discountAgorot),
  };
}
