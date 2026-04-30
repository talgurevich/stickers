import { NextResponse } from "next/server";
import { greenApi } from "@/lib/greenapi";

export const runtime = "nodejs";

// Debug: confirms the Green API instance is authorized (QR scanned).
export async function GET() {
  try {
    const ok = await greenApi.isAuthorized();
    return NextResponse.json({ authorized: ok });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
