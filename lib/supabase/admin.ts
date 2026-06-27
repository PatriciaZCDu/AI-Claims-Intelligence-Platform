import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the service-role key.
 * Bypasses RLS — only ever imported from server code (route handlers,
 * server components). Never expose the service key to the browser.
 *
 * Returns null when env is not configured, so the app can still boot and
 * render a friendly "configure Supabase" state instead of crashing.
 */
let cached: SupabaseClient | null = null;

export function getAdmin(): SupabaseClient | null {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function requireAdmin(): SupabaseClient {
  const admin = getAdmin();
  if (!admin) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return admin;
}

export const STORAGE_BUCKET = "claim-images";
