import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { getSupabaseSecretKey, getSupabaseUrl } from "./env";

/**
 * Elevated client — server actions / route handlers ONLY.
 * Never import this from client components.
 */
export function createAdminClient() {
  return createClient<Database>(getSupabaseUrl(), getSupabaseSecretKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
