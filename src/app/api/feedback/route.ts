import { NextResponse } from "next/server";
import { sendFeedbackToOwner } from "@/lib/email";

export const runtime = "nodejs";

const MAX_LEN = 4000;

export async function POST(req: Request) {
  let body: { message?: string; name?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  const message = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "missing-message" }, { status: 400 });
  }
  if (message.length > MAX_LEN) {
    return NextResponse.json({ error: "too-long" }, { status: 413 });
  }
  const result = await sendFeedbackToOwner({
    message,
    fromName: body.name?.trim() || undefined,
    fromEmail: body.email?.trim() || undefined,
  });
  if (result.kind === "error") {
    return NextResponse.json({ error: result.message }, { status: 502 });
  }
  return NextResponse.json({ ok: true, kind: result.kind });
}
