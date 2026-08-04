/**
 * Public Supabase key for browser + user-scoped server clients.
 * Prefer publishable key (sb_publishable_...); falls back to legacy anon JWT.
 */
export function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  return url;
}

export function getSupabasePublishableKey() {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  return key;
}

/**
 * Elevated server key — NEVER expose to the client.
 * Prefer secret key (sb_secret_...); falls back to legacy service_role JWT.
 */
export function getSupabaseSecretKey() {
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is missing. Add it from Supabase Dashboard → Settings → API Keys.",
    );
  }
  return key;
}
