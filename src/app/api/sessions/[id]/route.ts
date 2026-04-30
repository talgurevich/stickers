import { NextResponse } from "next/server";
import { getSession } from "@/lib/sessions";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const s = await getSession(id);
  if (!s) return NextResponse.json({ error: "not-found" }, { status: 404 });
  return NextResponse.json({
    id: s.id,
    phone: s.phoneE164,
    status: s.status,
    imageUrl: s.imageUrl,
  });
}
