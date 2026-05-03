import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";

export const runtime = "nodejs";

// Debug: last 10 orders, useful while PayPlus is offline so we can grab an
// id to feed into /api/admin/simulate-paid.
export async function GET() {
  const { data, error } = await serverClient()
    .from("orders")
    .select(
      "id, cart_id, phone_e164, size_mm, cut_type, quantity, total_agorot, paid_at, printful_order_id, printful_status, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
  return NextResponse.json({ orders: data ?? [] });
}
