// Resend transactional email wrapper.
//
// Boots a single client lazily; throws clearly if RESEND_API_KEY is missing
// at send time (lets the app run without it for dev / before signup).
//
// All templates are inline HTML — keeps the codepath simple, avoids a build
// step for MJML / templating libs. Hebrew copy with `dir="rtl"` on the body.

import { Resend } from "resend";
import { STICKER_VARIANTS, isStickerSize } from "./prodigi-catalog";
import { formatIls } from "./pricing";

let _client: Resend | null = null;
function client(): Resend {
  if (_client) return _client;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Missing RESEND_API_KEY");
  _client = new Resend(key);
  return _client;
}

/**
 * "From" address. Default uses Resend's onboarding sender (works without
 * domain verification — only deliverable to your own verified address).
 * Once a domain is verified in Resend, set RESEND_FROM=orders@wallaura.art.
 */
function fromAddress(): string {
  return process.env.RESEND_FROM ?? "Wallaura <onboarding@resend.dev>";
}

export type SendResult =
  | { kind: "sent"; id: string }
  | { kind: "skipped"; reason: string }
  | { kind: "error"; message: string };

async function send(args: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  if (!args.to || !args.to.includes("@")) {
    return { kind: "skipped", reason: "no-email" };
  }
  if (!process.env.RESEND_API_KEY) {
    return { kind: "skipped", reason: "no-key" };
  }
  try {
    const r = await client().emails.send({
      from: fromAddress(),
      to: args.to,
      subject: args.subject,
      html: args.html,
    });
    if (r.error) return { kind: "error", message: r.error.message };
    return { kind: "sent", id: r.data?.id ?? "" };
  } catch (e) {
    return {
      kind: "error",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

// --- Templates ---

function shell(title: string, body: string): string {
  return `<!doctype html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#fafaf9;font-family:'Heebo','Rubik','Arial Hebrew',Arial,sans-serif;color:#18181b;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    ${body}
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:32px 0;">
    <p style="font-size:12px;color:#71717a;text-align:center;">
      Wallaura Stickers · המדבקות שלך מהוואטסאפ, מודפסות אצלך בבית
    </p>
  </div>
</body>
</html>`;
}

export type OrderEmailInput = {
  to: string;
  orderId: string;
  size: string;
  quantity: number;
  totalAgorot: number;
  imageUrl?: string | null;
  shippingName?: string;
  shippingCity?: string;
};

export async function sendOrderConfirmation(
  o: OrderEmailInput,
): Promise<SendResult> {
  const variant = isStickerSize(o.size) ? STICKER_VARIANTS[o.size] : null;
  const sizeLabel = variant ? variant.labelHe : o.size;
  const html = shell(
    "ההזמנה שלך התקבלה",
    `
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;">קיבלנו את ההזמנה ✓</h1>
    <p style="font-size:15px;line-height:1.6;color:#3f3f46;">
      תודה! ההזמנה שלך נשלחה להדפסה. בעוד 7-14 ימי עסקים תקבל/י את המדבקות לכתובת שמסרת.
    </p>

    ${
      o.imageUrl
        ? `<div style="text-align:center;margin:24px 0;">
            <img src="${o.imageUrl}" alt="המדבקה שלך" style="max-width:240px;border-radius:12px;border:1px solid #e4e4e7;">
          </div>`
        : ""
    }

    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
      <tr><td style="padding:6px 0;color:#71717a;">מספר הזמנה</td>
          <td style="padding:6px 0;text-align:left;font-family:monospace;font-size:12px;">${o.orderId}</td></tr>
      <tr><td style="padding:6px 0;color:#71717a;">גודל</td>
          <td style="padding:6px 0;text-align:left;">${sizeLabel}</td></tr>
      <tr><td style="padding:6px 0;color:#71717a;">כמות</td>
          <td style="padding:6px 0;text-align:left;">${o.quantity}</td></tr>
      <tr><td style="padding:6px 0;color:#71717a;">סה״כ</td>
          <td style="padding:6px 0;text-align:left;font-weight:700;">${formatIls(o.totalAgorot)}</td></tr>
      ${
        o.shippingName
          ? `<tr><td style="padding:6px 0;color:#71717a;">משלוח אל</td>
                 <td style="padding:6px 0;text-align:left;">${o.shippingName}${o.shippingCity ? " · " + o.shippingCity : ""}</td></tr>`
          : ""
      }
    </table>

    <p style="font-size:13px;color:#71717a;line-height:1.6;">
      נעדכן אותך בוואטסאפ ובמייל ברגע שהמדבקות יוצאות לדרך.
    </p>
  `,
  );
  return send({ to: o.to, subject: "ההזמנה שלך מ-Wallaura התקבלה", html });
}

// --- Owner notifications (sent to OWNER_EMAIL on every new order) ---

export type OwnerOrderInput = {
  orderId: string;
  size: string;
  quantity: number;
  totalAgorot: number;
  customerPhone: string;
  customerEmail: string | null;
  imageUrl?: string | null;
  shippingName?: string;
  shippingStreet?: string;
  shippingCity?: string;
  shippingZip?: string;
  fulfillmentId?: string | null;
  fulfillmentStatus?: string | null;
};

export async function sendOwnerOrderNotification(
  o: OwnerOrderInput,
): Promise<SendResult> {
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!ownerEmail) return { kind: "skipped", reason: "no-owner-email" };
  const variant = isStickerSize(o.size) ? STICKER_VARIANTS[o.size] : null;
  const sizeLabel = variant ? variant.labelEn : o.size;
  const html = `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#18181b;background:#fafaf9;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <h2 style="margin:0 0 12px;">New order · ${sizeLabel} × ${o.quantity}</h2>
    <p style="font-size:14px;color:#3f3f46;margin:0 0 16px;">${formatIls(o.totalAgorot)} · order <code>${o.orderId}</code></p>
    ${o.imageUrl ? `<div style="margin:16px 0;"><img src="${o.imageUrl}" alt="" style="max-width:240px;border-radius:8px;border:1px solid #e4e4e7;"></div>` : ""}
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr><td style="padding:4px 0;color:#71717a;">Customer phone</td><td style="padding:4px 0;font-family:monospace;">+${o.customerPhone}</td></tr>
      <tr><td style="padding:4px 0;color:#71717a;">Customer email</td><td style="padding:4px 0;">${o.customerEmail ?? "—"}</td></tr>
      <tr><td style="padding:4px 0;color:#71717a;">Shipping</td><td style="padding:4px 0;">${o.shippingName ?? ""} · ${o.shippingStreet ?? ""}, ${o.shippingCity ?? ""} ${o.shippingZip ?? ""}</td></tr>
      <tr><td style="padding:4px 0;color:#71717a;">Fulfillment</td><td style="padding:4px 0;font-family:monospace;font-size:11px;">${o.fulfillmentId ?? "—"} · ${o.fulfillmentStatus ?? "—"}</td></tr>
    </table>
  </div></body></html>`;
  return send({
    to: ownerEmail,
    subject: `[Wallaura] New order · ${sizeLabel} × ${o.quantity} · ${formatIls(o.totalAgorot)}`,
    html,
  });
}

// --- Feedback (form on the site footer) ---

export type FeedbackInput = {
  message: string;
  fromName?: string;
  fromEmail?: string;
};

export async function sendFeedbackToOwner(
  f: FeedbackInput,
): Promise<SendResult> {
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!ownerEmail) return { kind: "skipped", reason: "no-owner-email" };
  const html = `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#18181b;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <h2 style="margin:0 0 12px;">Feedback from wallaura.art</h2>
    <p style="font-size:13px;color:#3f3f46;margin:0 0 16px;">
      From: ${f.fromName ?? "(anonymous)"}${f.fromEmail ? ` &lt;${f.fromEmail}&gt;` : ""}
    </p>
    <pre style="background:#fafaf9;border:1px solid #e4e4e7;border-radius:8px;padding:16px;font-family:inherit;white-space:pre-wrap;font-size:14px;line-height:1.5;">${f.message
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")}</pre>
  </div></body></html>`;
  return send({
    to: ownerEmail,
    subject: `[Wallaura feedback] ${f.message.slice(0, 60).replace(/\s+/g, " ")}`,
    html,
  });
}

export type ShippedEmailInput = {
  to: string;
  orderId: string;
  trackingUrl?: string | null;
};

export async function sendShippedNotification(
  o: ShippedEmailInput,
): Promise<SendResult> {
  const html = shell(
    "ההזמנה שלך נשלחה",
    `
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;">המדבקות בדרך אליך 🚚</h1>
    <p style="font-size:15px;line-height:1.6;color:#3f3f46;">
      ההזמנה שלך הופקה ויצאה למשלוח. עוד כמה ימי עסקים והיא תגיע.
    </p>
    ${
      o.trackingUrl
        ? `<p style="margin:24px 0;text-align:center;">
            <a href="${o.trackingUrl}"
               style="display:inline-block;background:#18181b;color:white;text-decoration:none;
                      padding:12px 24px;border-radius:9999px;font-weight:500;font-size:14px;">
              מעקב משלוח
            </a>
           </p>`
        : ""
    }
    <p style="font-size:13px;color:#71717a;font-family:monospace;">${o.orderId}</p>
  `,
  );
  return send({ to: o.to, subject: "ההזמנה שלך מ-Wallaura יצאה למשלוח", html });
}
