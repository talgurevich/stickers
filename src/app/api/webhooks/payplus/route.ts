import { NextResponse } from "next/server";

export const runtime = "nodejs";

// PayPlus IPN. Locally (no public URL) this won't be called; once deployed,
// PayPlus posts here after a transaction settles.
// TODO: verify HMAC once the webhook is configured in the PayPlus dashboard
// (the dashboard reveals the HMAC secret on save). The brief flags this as
// "verify on every callback" — must not be skipped before live cutover.
export async function POST(req: Request) {
  const body = await req.text();
  const headers = Object.fromEntries(req.headers);
  console.log("[payplus webhook]", { headers, body });
  return NextResponse.json({ ok: true });
}
