"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client (anon key). Used for Realtime subscriptions on the
 * AI pipeline screen. Read access is gated by RLS "anon read" policies; all
 * writes happen server-side via the service role.
 */
let cached: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient | null {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  cached = createClient(url, key, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return cached;
}
