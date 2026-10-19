import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null | undefined;

/**
 * Admin client. Unlike the resident client in lib/supabase/client.ts it keeps the signed-in
 * session (own storage key) so the realtime connection and every query carry the admin's JWT.
 * Returns null when Supabase isn't configured.
 */
export function getAdminSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  cached =
    url && key
      ? createClient(url, key, {
          auth: { persistSession: true, autoRefreshToken: true, storageKey: "dayzero-admin-auth" },
        })
      : null;
  return cached;
}
