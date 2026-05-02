import { NextResponse } from "next/server";
import { createSession } from "@/lib/sessions";
import { sweepOrphansForSession } from "@/lib/whatsapp-ingest";
import { notifyPhoneEntered } from "@/lib/slack";

export const runtime = "nodejs";

function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0") && digits.length === 10) return "972" + digits.slice(1);
  if (digits.length === 9) return "972" + digits;
  if (digits.startsWith("972")) return digits;
  return digits;
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
  try {
    const session = await createSession(phone);
    // Adopt any recent unmatched orphan for this phone — covers the case
    // where the user sent a WA sticker first, then opened the web flow.
    const adopted = await sweepOrphansForSession({
      sessionId: session.id,
      phoneE164: phone,
    });
    void notifyPhoneEntered({
      phone,
      sessionId: session.id,
      orphanAdopted: Boolean(adopted),
    });
    return NextResponse.json({
      id: session.id,
      phone: session.phoneE164,
      status: adopted ? "image_received" : session.status,
      orphanAdopted: adopted,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
