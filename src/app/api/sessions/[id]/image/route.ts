import { readImage } from "@/lib/sessions";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const blob = readImage(id);
  if (!blob) return new Response("not-found", { status: 404 });
  // Convert Node Buffer → Uint8Array for the Web Response body.
  return new Response(new Uint8Array(blob.buffer), {
    headers: {
      "Content-Type": blob.mime,
      "Cache-Control": "no-store",
    },
  });
}
