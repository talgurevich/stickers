import { NextResponse } from "next/server";
import sharp from "sharp";
import { attachImage, getSession } from "@/lib/sessions";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ACCEPT = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const session = getSession(id);
  if (!session) {
    return NextResponse.json({ error: "session-not-found" }, { status: 404 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing-file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file-too-large" }, { status: 413 });
  }
  if (file.type && !ACCEPT.includes(file.type)) {
    return NextResponse.json(
      { error: "unsupported-type", got: file.type },
      { status: 415 },
    );
  }

  const input = Buffer.from(await file.arrayBuffer());

  // Animated webp/gif → frame 0 PNG (per BRIEF.md "Animated WhatsApp stickers").
  // Always normalize to PNG so downstream Printful upload is uniform.
  let processed: Buffer;
  try {
    processed = await sharp(input, { animated: false }).png().toBuffer();
  } catch (e) {
    return NextResponse.json(
      { error: "image-decode-failed", message: e instanceof Error ? e.message : String(e) },
      { status: 422 },
    );
  }

  const result = attachImage(id, processed, "image/png");
  if (!result) {
    return NextResponse.json({ error: "session-not-found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, imageUrl: result.url });
}
