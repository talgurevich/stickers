// Fire-and-forget Slack notifications via an Incoming Webhook.
// Failures are logged and swallowed — Slack must never block a user request.

type SlackField = { title: string; value: string; short?: boolean };

type SlackPayload = {
  text: string;
  fields?: SlackField[];
};

function shekels(agorot: number): string {
  return `₪${(agorot / 100).toFixed(2)}`;
}

async function postSlack(payload: SlackPayload): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;

  const attachments = payload.fields?.length
    ? [{ color: "#36a64f", fields: payload.fields }]
    : undefined;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: payload.text, attachments }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[slack] webhook ${res.status}: ${body.slice(0, 200)}`);
    }
  } catch (e) {
    console.warn("[slack] post failed:", e instanceof Error ? e.message : e);
  }
}

export function notifyPhoneEntered(args: {
  phone: string;
  sessionId: string;
  orphanAdopted: boolean;
}): Promise<void> {
  return postSlack({
    text: `:iphone: Phone entered — ${args.phone}`,
    fields: [
      { title: "Session", value: args.sessionId, short: true },
      {
        title: "WA sticker waiting?",
        value: args.orphanAdopted ? "yes (adopted)" : "no",
        short: true,
      },
    ],
  });
}

export function notifyPhotoUploaded(args: {
  phone: string | null;
  sessionId: string;
  imagePath: string;
}): Promise<void> {
  return postSlack({
    text: `:frame_with_picture: Photo uploaded`,
    fields: [
      { title: "Phone", value: args.phone ?? "—", short: true },
      { title: "Session", value: args.sessionId, short: true },
      { title: "Path", value: args.imagePath, short: false },
    ],
  });
}

export function notifyCheckoutStarted(args: {
  orderId: string;
  phone: string | null;
  email: string | null;
  productType: string;
  size: string;
  quantity: number;
  totalAgorot: number;
  country: string;
  mode: "test" | "live";
}): Promise<void> {
  return postSlack({
    text: `:shopping_trolley: Checkout started — ${shekels(args.totalAgorot)} (${args.mode})`,
    fields: [
      { title: "Order", value: args.orderId, short: true },
      { title: "Phone", value: args.phone ?? "—", short: true },
      { title: "Email", value: args.email ?? "—", short: true },
      {
        title: "Item",
        value: `${args.productType} ${args.size} ×${args.quantity}`,
        short: true,
      },
      { title: "Country", value: args.country, short: true },
    ],
  });
}

export function notifyPaymentCompleted(args: {
  orderId: string;
  phone: string | null;
  email: string | null;
  totalAgorot: number;
  source: string;
}): Promise<void> {
  return postSlack({
    text: `:moneybag: Payment completed — ${shekels(args.totalAgorot)}`,
    fields: [
      { title: "Order", value: args.orderId, short: true },
      { title: "Source", value: args.source, short: true },
      { title: "Phone", value: args.phone ?? "—", short: true },
      { title: "Email", value: args.email ?? "—", short: true },
    ],
  });
}
