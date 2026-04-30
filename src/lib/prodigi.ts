// Thin Prodigi Print API client (v4.0).
//
// Auth: X-API-Key header.
// Base: sandbox at api.sandbox.prodigi.com/v4.0, live at api.prodigi.com/v4.0
// Docs: https://www.prodigi.com/print-api/docs/reference/

import { env } from "./env";

export class ProdigiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly raw?: unknown,
  ) {
    super(message);
    this.name = "ProdigiError";
  }
}

async function request<T>(
  path: string,
  init?: RequestInit & { query?: Record<string, string | number | undefined> },
): Promise<T> {
  const cfg = env.prodigi();
  const url = new URL(cfg.baseUrl.replace(/\/$/, "") + path);
  if (init?.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url, {
    ...init,
    headers: {
      "X-API-Key": cfg.apiKey,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new ProdigiError(
      `Non-JSON response from Prodigi (HTTP ${res.status}): ${text.slice(0, 300)}`,
      res.status,
    );
  }
  if (!res.ok) {
    const j = json as {
      outcome?: string;
      issues?: Array<{ description?: string; objectId?: string }>;
      errorCode?: string;
      message?: string;
    };
    const reason =
      j.issues?.map((i) => i.description).filter(Boolean).join("; ") ||
      j.message ||
      j.outcome ||
      `HTTP ${res.status}`;
    throw new ProdigiError(`Prodigi ${path} failed: ${reason}`, res.status, json);
  }
  return json as T;
}

// --- Orders ---

export type ProdigiAddress = {
  line1: string;
  line2?: string;
  postalOrZipCode: string;
  countryCode: string; // ISO-2; "IL" supported
  townOrCity: string;
  stateOrCounty?: string | null;
};

export type ProdigiRecipient = {
  name: string;
  email?: string;
  phoneNumber?: string;
  address: ProdigiAddress;
};

export type ProdigiOrderItem = {
  sku: string;
  copies: number;
  sizing?: "fillPrintArea" | "fitPrintArea" | "stretchToPrintArea";
  assets: Array<{ printArea: string; url: string }>;
};

export type ProdigiCreateOrder = {
  merchantReference?: string;
  shippingMethod?: "Budget" | "Standard" | "Express" | "Overnight";
  recipient: ProdigiRecipient;
  items: ProdigiOrderItem[];
  metadata?: Record<string, unknown>;
};

export type ProdigiOrderResponse = {
  outcome: string;
  order: {
    id: string;
    status: { stage: string };
    merchantReference?: string;
  };
};

export async function createOrder(
  input: ProdigiCreateOrder,
): Promise<ProdigiOrderResponse> {
  return request("/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getOrder(orderId: string): Promise<ProdigiOrderResponse> {
  return request(`/orders/${orderId}`, { method: "GET" });
}

// --- Quotes (price + shipping check before order) ---

export type ProdigiQuoteRequest = {
  shippingMethod?: "Budget" | "Standard" | "Express" | "Overnight";
  destinationCountryCode: string;
  items: Array<{ sku: string; copies: number }>;
};

export async function quote(
  input: ProdigiQuoteRequest,
): Promise<{
  outcome: string;
  quotes: Array<{
    shippingMethod: string;
    costSummary: { totalCost: { amount: string; currency: string } };
  }>;
}> {
  return request("/quotes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// --- Catalog ---
// Prodigi v4.0 doesn't expose a single "list all products" endpoint the way
// Printful does. SKU lookup is done via the product catalog endpoint by SKU.
// We hit it once to validate a SKU exists & supports our destination.
export async function getProduct(sku: string): Promise<{
  outcome: string;
  product: {
    sku: string;
    description: string;
    productDimensions?: { width: number; height: number; units: string };
    attributes?: Record<string, unknown>;
  };
}> {
  return request(`/products/${encodeURIComponent(sku)}`, { method: "GET" });
}
