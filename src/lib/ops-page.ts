import { redirect } from "next/navigation";

import { loadDashboardProfile } from "@/lib/auth/session";
import type { AppUser } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export async function requireOpsContext() {
  const ctx = await loadDashboardProfile();
  if (!ctx) redirect("/login");
  return ctx;
}

export function scopeByProfile<T extends { eq: (c: string, v: string) => T }>(
  query: T,
  profile: AppUser,
) {
  let q = query;
  if (profile.vendor_id) q = q.eq("vendor_id", profile.vendor_id);
  if (profile.branch_id) q = q.eq("branch_id", profile.branch_id);
  return q;
}

export type OpsCtx = {
  supabase: SupabaseClient<Database>;
  profile: AppUser;
};
