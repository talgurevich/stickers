"use client";

// Browser-side Supabase client for Realtime subscriptions only. The session
// data we mutate always goes through API routes (server-side, service-role) —
// the browser never writes directly. This client is read-only via Realtime.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Supabase browser client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  _client = createClient(url, anon, {
    auth: { persistSession: false },
  });
  return _client;
}
