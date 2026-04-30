// Thin PayPlus REST client. Endpoint and auth pattern derived from the
// official PayPlus PHP SDK (https://github.com/ZevWisegroup/payplus-api),
// which is owned by PayPlus LTD.
//
// Auth: an `Authorization` header whose value is a JSON-encoded
// {api_key, secret_key} object. Yes, really — not Bearer, not Basic.
//
// Success envelope: { results: { status: "success" }, data: { ... } }
// Error envelope:   { results: { status: "error", description: "..." } }
//                or { message: "..." }

import { env } from "./env";

export type GenerateLinkInput = {
  amount: number;
  currencyCode?: "ILS" | "USD" | "EUR";
  /** Free-form string echoed back in the IPN — use it to carry our session/order id. */
  moreInfo?: string;
  /** Optional URL overrides; otherwise the dashboard defaults are used. */
  refUrlSuccess?: string;
  refUrlFailure?: string;
  refUrlCallback?: string;
};

export type GenerateLinkResult = {
  pageRequestUid: string;
  paymentPageLink: string;
};

export class PayPlusError extends Error {
  constructor(
    message: string,
    readonly raw?: unknown,
  ) {
    super(message);
    this.name = "PayPlusError";
  }
}

export async function generatePaymentLink(
  input: GenerateLinkInput,
): Promise<GenerateLinkResult> {
  const cfg = env.payplus();
  const pageUid = process.env.PAYPLUS_PAYMENT_PAGE_UID;
  if (!pageUid) {
    throw new PayPlusError("Missing PAYPLUS_PAYMENT_PAGE_UID");
  }

  const url = `${cfg.baseUrl.replace(/\/$/, "")}/PaymentPages/generateLink`;

  const body: Record<string, unknown> = {
    payment_page_uid: pageUid,
    amount: input.amount,
    currency_code: input.currencyCode ?? "ILS",
  };
  if (input.moreInfo) body.more_info = input.moreInfo;
  if (input.refUrlSuccess) body.refURL_success = input.refUrlSuccess;
  if (input.refUrlFailure) body.refURL_failure = input.refUrlFailure;
  if (input.refUrlCallback) body.refURL_callback = input.refUrlCallback;

  const auth = JSON.stringify({
    api_key: cfg.apiKey,
    secret_key: cfg.secretKey,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: auth,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new PayPlusError(
      `Non-JSON response from PayPlus (HTTP ${res.status}): ${text.slice(0, 300)}`,
    );
  }

  const j = json as {
    results?: { status?: string; description?: string };
    data?: { page_request_uid?: string; payment_page_link?: string };
    message?: string;
  };

  if (j.results?.status !== "success" || !j.data?.payment_page_link) {
    const reason =
      j.results?.description ||
      j.message ||
      `HTTP ${res.status}`;
    throw new PayPlusError(`PayPlus generateLink failed: ${reason}`, json);
  }

  return {
    pageRequestUid: j.data.page_request_uid ?? "",
    paymentPageLink: j.data.payment_page_link,
  };
}
