// Thin Printful V2 REST client.
// Auth: Bearer token (Private Token from the Developer Portal).
// Base: https://api.printful.com/v2

import { env } from "./env";

const BASE = "https://api.printful.com/v2";

export class PrintfulError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly raw?: unknown,
  ) {
    super(message);
    this.name = "PrintfulError";
  }
}

async function request<T>(
  path: string,
  init?: RequestInit & { query?: Record<string, string | number | undefined> },
): Promise<T> {
  const { token } = env.printfulOutbound();
  const url = new URL(BASE + path);
  if (init?.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
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
    throw new PrintfulError(
      `Non-JSON response from Printful (HTTP ${res.status}): ${text.slice(0, 300)}`,
      res.status,
    );
  }
  if (!res.ok) {
    const j = json as { error?: { message?: string }; message?: string };
    const reason = j.error?.message ?? j.message ?? `HTTP ${res.status}`;
    throw new PrintfulError(`Printful ${path} failed: ${reason}`, res.status, json);
  }
  return json as T;
}

// --- Catalog ---

export type CatalogProduct = {
  id: number;
  name: string;
  type?: string;
  techniques?: string[];
  // Printful's full shape is much wider; we only ever read these fields.
};

export async function listCatalogProducts(opts: {
  types?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ data: CatalogProduct[]; paging?: unknown }> {
  return request("/catalog-products", {
    method: "GET",
    query: {
      types: opts.types,
      limit: opts.limit ?? 100,
      offset: opts.offset ?? 0,
    },
  });
}

export async function getCatalogProductVariants(productId: number): Promise<{
  data: Array<{
    id: number;
    catalog_product_id: number;
    name: string;
    size?: string;
    color?: string;
  }>;
}> {
  return request(`/catalog-products/${productId}/catalog-variants`, {
    method: "GET",
    query: { limit: 100 },
  });
}

// --- Orders ---

export type OrderRecipient = {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  country_code: string;
  state_code?: string;
  zip: string;
  phone?: string;
  email?: string;
};

export type OrderItem = {
  quantity: number;
  catalog_variant_id: number;
  source: "catalog";
  placements: Array<{
    placement: string;
    technique: string;
    layers: Array<{ type: "file"; url: string }>;
  }>;
};

export async function createOrder(input: {
  external_id?: string;
  recipient: OrderRecipient;
  items: OrderItem[];
}): Promise<{ data: { id: number; status: string } }> {
  return request("/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// --- Webhooks ---

export async function listWebhooks(): Promise<{
  data: Array<{ id: number; url: string; events: string[] }>;
}> {
  return request("/webhooks", { method: "GET" });
}

export async function createWebhook(input: {
  url: string;
  events: string[];
}): Promise<{ data: { id: number; url: string; events: string[] } }> {
  return request("/webhooks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
