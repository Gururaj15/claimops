import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Returns a Supabase client only if both env vars are configured. The app
 * runs entirely on in-memory seed data (see seed-data.ts) when they're not
 * set, so `npm run dev` works with zero setup. Wiring a real Supabase
 * project (free tier) makes claim status changes and new claims persist —
 * see /docs/DEPLOY.md.
 */
export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!client) client = createClient(url, key);
  return client;
}

export const isPersistenceConfigured = () => getSupabase() !== null;
