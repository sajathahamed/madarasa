import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/types/database";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export { roleLabel } from "@/lib/auth/roles";

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

/** True admin for this vendor (Akram) — only these roles may edit / manage. */
export function isVendorAdmin(role: string) {
  return role === "vendor_admin" || role === "super_admin";
}

/** Edit student profile, fee plan, mark left — Admin and Data entry. */
export function canEditStudent(role: string) {
  return canEnterData(role);
}

/** Admin delete dashboard — Admin only. */
export function canManageAdminOps(role: string) {
  return isVendorAdmin(role);
}

/** Approve / reject payments & donations (Admin; legacy money roles kept). */
export function canApproveMoney(role: string) {
  return ["super_admin", "vendor_admin", "accountant", "principal"].includes(
    role,
  );
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

/** Create/edit class definitions — Admin only. */
export function canManageClasses(role: string) {
  return isVendorAdmin(role);
}

/** Assign / change a student's Hifz or Sariya class — Admin and Data entry. */
export function canEnrollStudents(role: string) {
  return canEnterData(role);
}

/** Library catalog + loans — Admin and Data entry. */
export function canManageLibrary(role: string) {
  return (
    isVendorAdmin(role) ||
    role === "data_entry" ||
    role === "principal"
  );
}

export function canLogProgress(role: string) {
  return ["super_admin", "vendor_admin", "principal", "data_entry"].includes(
    role,
  );
}

/** Custom SMS compose page (Dialog / Upview Tech mask). */
export function canSendSms(role: string) {
  return [
    "super_admin",
    "vendor_admin",
    "data_entry",
    "accountant",
    "principal",
  ].includes(role);
}

export function opsNav(profile: AppUser) {
  const canApprove = canApproveMoney(profile.role);
  const smsLink = canSendSms(profile.role)
    ? [{ href: "/branch/sms", label: "Send SMS" }]
    : [];

  // Vendor staff: Admin (vendor_admin) and Data entry only for day-to-day.
  if (profile.role === "vendor_admin") {
    return [
      { href: "/vendor", label: "Vendor overview" },
      { href: "/branch", label: "Overview" },
      { href: "/branch/accountant", label: "Approvals desk" },
      { href: "/branch/students", label: "Students" },
      { href: "/branch/staff", label: "Staff" },
      { href: "/branch/fees", label: "Fees" },
      { href: "/branch/approvals", label: "Approvals" },
      { href: "/branch/donations", label: "Donations" },
      { href: "/branch/classes", label: "Classes" },
      { href: "/branch/library", label: "Library" },
      { href: "/branch/attendance", label: "Attendance" },
      { href: "/branch/progress", label: "Progress" },
      ...smsLink,
      { href: "/branch/reports", label: "Reports" },
      { href: "/branch/admin", label: "Admin delete" },
    ];
  }

  if (profile.role === "data_entry") {
    return [
      { href: "/branch", label: "Overview" },
      { href: "/branch/students", label: "Students" },
      { href: "/branch/staff", label: "Staff" },
      { href: "/branch/fees", label: "Fees" },
      { href: "/branch/approvals", label: "My submissions" },
      { href: "/branch/donations", label: "Donations" },
      { href: "/branch/classes", label: "Classes" },
      { href: "/branch/library", label: "Library" },
      { href: "/branch/attendance", label: "Attendance" },
      { href: "/branch/progress", label: "Progress" },
      ...smsLink,
      { href: "/branch/reports", label: "Reports" },
    ];
  }

  // Legacy accountant / principal / platform
  const items =
    profile.role === "accountant"
      ? [
          { href: "/branch/accountant", label: "Approvals desk" },
          { href: "/branch/fees", label: "Record payment" },
          { href: "/branch/approvals", label: "All approvals" },
          { href: "/branch/students", label: "Students" },
          ...smsLink,
          { href: "/branch/reports", label: "Reports" },
          { href: "/branch", label: "Overview" },
        ]
      : [
          { href: "/branch", label: "Overview" },
          ...(canApprove
            ? [{ href: "/branch/accountant", label: "Approvals desk" }]
            : []),
          { href: "/branch/students", label: "Students" },
          { href: "/branch/staff", label: "Staff" },
          { href: "/branch/fees", label: "Fees" },
          { href: "/branch/approvals", label: "Approvals" },
          { href: "/branch/donations", label: "Donations" },
          { href: "/branch/classes", label: "Classes" },
          { href: "/branch/library", label: "Library" },
          { href: "/branch/attendance", label: "Attendance" },
          { href: "/branch/progress", label: "Progress" },
          ...smsLink,
          { href: "/branch/reports", label: "Reports" },
        ];

  if (canManageAdminOps(profile.role)) {
    items.push({ href: "/branch/admin", label: "Admin delete" });
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
