import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Printful webhook. Locally (no public URL) this won't be called; once
// deployed, Printful posts here on package_shipped, package_returned, and
// order_canceled events.
// TODO: verify request signature once the webhook is registered in Printful's
// dashboard and the secret is issued. Brief flags this is mandatory before
// production cutover.
export async function POST(req: Request) {
  const body = await req.text();
  const headers = Object.fromEntries(req.headers);
  console.log("[printful webhook]", { headers, body });
  return NextResponse.json({ ok: true });
}
