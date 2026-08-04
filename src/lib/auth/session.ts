import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/types/database";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type AuthOk = {
  supabase: SupabaseClient<Database>;
  user: User;
  profile: AppUser;
};

export async function requireProfile(): Promise<AuthOk | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.status !== "active") {
    return { error: "Forbidden" };
  }
  return { supabase, user, profile };
}

export function canEnterData(role: string) {
  return ["super_admin", "vendor_admin", "data_entry"].includes(role);
}

export function canMarkAttendance(role: string) {
  return [
    "super_admin",
    "vendor_admin",
    "principal",
    "data_entry",
    "accountant",
  ].includes(role);
}

export function canManageClasses(role: string) {
  return ["super_admin", "vendor_admin", "principal", "data_entry"].includes(
    role,
  );
}

export function canLogProgress(role: string) {
  return ["super_admin", "vendor_admin", "principal", "data_entry"].includes(
    role,
  );
}

export function opsNav(profile: AppUser) {
  const items = [
    { href: "/branch", label: "Overview" },
    { href: "/branch/students", label: "Students" },
    { href: "/branch/fees", label: "Fees" },
    { href: "/branch/approvals", label: "Approvals" },
    { href: "/branch/donations", label: "Donations" },
    { href: "/branch/classes", label: "Classes" },
    { href: "/branch/attendance", label: "Attendance" },
    { href: "/branch/progress", label: "Progress" },
    { href: "/branch/reports", label: "Reports" },
  ];
  if (profile.role === "vendor_admin") {
    items.push({ href: "/vendor", label: "Vendor" });
  }
  if (profile.role === "super_admin") {
    items.push({ href: "/super-admin", label: "Platform" });
  }
  return items;
}

export async function loadDashboardProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.status !== "active") return null;
  return { supabase, user, profile };
}
