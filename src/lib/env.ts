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
    instanceId: required("GREEN_API_INSTANCE_ID"),
    token: required("GREEN_API_TOKEN"),
    webhookSecret: optional("GREEN_API_WEBHOOK_SECRET"),
  }),

  printful: () => ({
    token: required("PRINTFUL_PRIVATE_TOKEN"),
    webhookSecret: required("PRINTFUL_WEBHOOK_SECRET"),
  }),

  resendApiKey: () => required("RESEND_API_KEY"),

  supabase: () => ({
    url: required("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  }),
};
