// Supabase clients. Two flavors:
//   - serverClient: uses service-role key, bypasses RLS, server-only
//   - browserClient: uses publishable key, RLS enforced, safe to ship
//
// Server code that needs to write to sessions / storage must use the server
// client. Anything in a "use client" component or NEXT_PUBLIC env should use
// the browser client (mostly: Realtime subscriptions on the configurator
// "waiting for sticker" page).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let _server: SupabaseClient | null = null;

export function serverClient(): SupabaseClient {
  if (_server) return _server;
  const cfg = env.supabase();
  _server = createClient(cfg.url, cfg.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _server;
}

export function browserClient(): SupabaseClient {
  // Per-request fresh client is fine — supabase-js is cheap to instantiate
  // and we don't want session state to leak across users on the server side.
  const cfg = env.supabase();
  return createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

export const STORAGE_BUCKET = "stickers";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
