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

/** Profile + fee plan edits (ops staff including accountant/principal). */
export function canEditStudent(role: string) {
  return [
    "super_admin",
    "vendor_admin",
    "data_entry",
    "accountant",
    "principal",
  ].includes(role);
}

/** Separate admin dashboard: delete / void operational records. */
export function canManageAdminOps(role: string) {
  return ["super_admin", "vendor_admin", "principal"].includes(role);
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
  const isMoneyRole = ["accountant", "principal", "vendor_admin", "super_admin"].includes(
    profile.role,
  );

  const items =
    profile.role === "accountant"
      ? [
          { href: "/branch/accountant", label: "Accountant desk" },
          { href: "/branch/fees", label: "Record payment" },
          { href: "/branch/approvals", label: "All approvals" },
          { href: "/branch/students", label: "Students" },
          { href: "/branch/reports", label: "Reports" },
          { href: "/branch", label: "Overview" },
        ]
      : [
          { href: "/branch", label: "Overview" },
          ...(isMoneyRole
            ? [{ href: "/branch/accountant", label: "Accountant desk" }]
            : []),
          { href: "/branch/students", label: "Students" },
          { href: "/branch/fees", label: "Fees" },
          { href: "/branch/approvals", label: "Approvals" },
          { href: "/branch/donations", label: "Donations" },
          { href: "/branch/classes", label: "Classes" },
          { href: "/branch/attendance", label: "Attendance" },
          { href: "/branch/progress", label: "Progress" },
          { href: "/branch/reports", label: "Reports" },
        ];

  if (canManageAdminOps(profile.role)) {
    items.push({ href: "/branch/admin", label: "Admin" });
  }
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
