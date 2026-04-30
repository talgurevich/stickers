// Read env vars at request time, not build time. Each accessor throws a clear
// error if the var is missing — so the app can boot without keys, and only the
// route that actually needs a key fails.

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const env = {
  appUrl: () => process.env.APP_URL ?? "http://localhost:3000",

  // Outbound — needed to call PayPlus to create payment pages.
  payplus: () => ({
    baseUrl: required("PAYPLUS_BASE_URL"),
    apiKey: required("PAYPLUS_API_KEY"),
    secretKey: required("PAYPLUS_SECRET_KEY"),
  }),

  // Inbound — needed only when verifying incoming IPN callbacks.
  payplusHmacSecret: () => required("PAYPLUS_HMAC_SECRET"),

  greenApi: () => ({
    baseUrl: process.env.GREEN_API_BASE_URL ?? "https://api.green-api.com",
    mediaUrl: process.env.GREEN_API_MEDIA_URL,
    instanceId: required("GREEN_API_INSTANCE_ID"),
    token: required("GREEN_API_TOKEN"),
    webhookSecret: optional("GREEN_API_WEBHOOK_SECRET"),
  }),

  // Outbound — needed to call Printful.
  printfulOutbound: () => ({
    token: required("PRINTFUL_PRIVATE_TOKEN"),
    storeId: optional("PRINTFUL_STORE_ID"),
  }),

  // Inbound — needed only when verifying incoming Printful webhooks.
  printfulWebhookSecret: () => required("PRINTFUL_WEBHOOK_SECRET"),

  // Prodigi (replacing Printful for IL shipping).
  prodigi: () => ({
    baseUrl:
      process.env.PRODIGI_BASE_URL ?? "https://api.sandbox.prodigi.com/v4.0",
    apiKey: required("PRODIGI_API_KEY"),
  }),

  resendApiKey: () => required("RESEND_API_KEY"),
  resendConfigured: () => Boolean(process.env.RESEND_API_KEY),

  supabase: () => ({
    url: required("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  }),
};
