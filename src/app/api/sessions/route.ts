import { NextResponse } from "next/server";
import { createSession } from "@/lib/sessions";

export const runtime = "nodejs";

function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  // Common Israeli inputs: 0501234567 → 972501234567; 501234567 → 972501234567
  if (digits.startsWith("0") && digits.length === 10) return "972" + digits.slice(1);
  if (digits.length === 9) return "972" + digits;
  if (digits.startsWith("972")) return digits;
  return digits; // already E.164-ish
}

export async function POST(req: Request) {
  let body: { phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  const phone = body.phone ? normalizePhone(body.phone) : null;
  if (!phone || phone.length < 10) {
    return NextResponse.json({ error: "invalid-phone" }, { status: 400 });
  }
  const session = createSession(phone);
  return NextResponse.json({
    id: session.id,
    phone: session.phoneE164,
    status: session.status,
  });
}
