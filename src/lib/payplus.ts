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
  /**
   * Customer details forwarded to PayPlus so the transaction is attributed
   * to a real person (visible in the dashboard, used for invoicing).
   * Both customer_name and email are required for PayPlus to accept the
   * customer object.
   */
  customer?: {
    customer_name: string;
    email: string;
    phone?: string;
    address?: string;
    city?: string;
    country_ISO?: string;
  };
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
  if (input.customer && input.customer.customer_name && input.customer.email) {
    body.customer = input.customer;
  }

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

export type VerifiedTransaction = {
  ok: boolean;
  statusCode: string | null;
  /** PayPlus echoes more_info back here when verifying. */
  moreInfo: string | null;
  amount: number | null;
  raw: unknown;
};

/**
 * Re-query PayPlus to confirm a transaction the IPN told us about. Endpoint
 * derived from the official PHP SDK (PaymentPages/ipn). Pass either a
 * transaction_uid or a payment_request_uid. Auth header is the same JSON
 * `{api_key, secret_key}` shape used by generateLink.
 *
 * Treats `data.result.status_code === "000"` as the canonical "paid" signal
 * (matches the PHP SDK's IsSuccess()).
 */
export async function verifyTransaction(args: {
  transactionUid?: string | null;
  paymentRequestUid?: string | null;
}): Promise<VerifiedTransaction> {
  const cfg = env.payplus();
  if (!args.transactionUid && !args.paymentRequestUid) {
    throw new PayPlusError("verifyTransaction: missing transaction id");
  }

  const url = `${cfg.baseUrl.replace(/\/$/, "")}/PaymentPages/ipn`;
  const body: Record<string, string> = {};
  if (args.transactionUid) body.transaction_uid = args.transactionUid;
  if (args.paymentRequestUid) body.payment_request_uid = args.paymentRequestUid;

  const auth = JSON.stringify({
    api_key: cfg.apiKey,
    secret_key: cfg.secretKey,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await res.text();
  console.log("[payplus verify] raw", {
    httpStatus: res.status,
    bodyPreview: text.slice(0, 1500),
  });

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, statusCode: null, moreInfo: null, amount: null, raw: text };
  }

  // PayPlus's verify response shape isn't documented and varies — pull
  // status_code from any known nesting (top level / data.result / transaction).
  const candidates = [
    (json as Record<string, unknown>)?.transaction,
    (json as { data?: { result?: unknown } })?.data?.result,
    (json as { data?: unknown })?.data,
    json,
  ];
  let statusCode: string | null = null;
  let moreInfo: string | null = null;
  let amountRaw: unknown = null;
  for (const c of candidates) {
    if (!c || typeof c !== "object") continue;
    const obj = c as Record<string, unknown>;
    if (statusCode == null && typeof obj.status_code === "string") {
      statusCode = obj.status_code;
    }
    if (moreInfo == null && typeof obj.more_info === "string") {
      moreInfo = obj.more_info;
    }
    if (amountRaw == null && (typeof obj.amount === "number" || typeof obj.amount === "string")) {
      amountRaw = obj.amount;
    }
  }
  const amount =
    typeof amountRaw === "number"
      ? amountRaw
      : typeof amountRaw === "string"
        ? Number(amountRaw)
        : null;

  const resultsStatus = (json as { results?: { status?: string } })?.results?.status;
  // "Verified" means: PayPlus's IPN endpoint either echoed status_code=000,
  // OR it acknowledged the request as successful (results.status=success).
  // The IPN body itself carries status_code=000 — re-querying is a forgery
  // check, not the source of truth.
  const ok = statusCode === "000" || resultsStatus === "success";

  return {
    ok,
    statusCode,
    moreInfo,
    amount: Number.isFinite(amount) ? (amount as number) : null,
    raw: json,
  };
}
