import { NextResponse } from "next/server";
import { getSession, updateSession } from "@/lib/sessions";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const s = getSession(id);
  if (!s) return NextResponse.json({ error: "not-found" }, { status: 404 });
  return NextResponse.json({
    id: s.id,
    phone: s.phoneE164,
    status: s.status,
    imageUrl: s.imageUrl,
    config: s.config,
  });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  let body: {
    sizeMm?: number;
    cut?: string;
    quantity?: number;
    address?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  const config: Record<string, unknown> = {};
  if (body.sizeMm !== undefined) {
    if (![50, 70, 100].includes(body.sizeMm)) {
      return NextResponse.json({ error: "invalid-sizeMm" }, { status: 400 });
    }
    config.sizeMm = body.sizeMm;
  }
  if (body.cut !== undefined) {
    if (!["kiss_cut", "rectangle"].includes(body.cut)) {
      return NextResponse.json({ error: "invalid-cut" }, { status: 400 });
    }
    config.cut = body.cut;
  }
  if (body.quantity !== undefined) {
    if (
      typeof body.quantity !== "number" ||
      body.quantity < 1 ||
      body.quantity > 50
    ) {
      return NextResponse.json({ error: "invalid-quantity" }, { status: 400 });
    }
    config.quantity = body.quantity;
  }
  if (body.address !== undefined) {
    config.address = body.address;
  }

  const updated = updateSession(id, {
    config: config as never,
    status: "configuring",
  });
  if (!updated) return NextResponse.json({ error: "not-found" }, { status: 404 });

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    config: updated.config,
  });
}
