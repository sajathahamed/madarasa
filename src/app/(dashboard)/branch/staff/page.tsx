import { StaffClient } from "@/components/staff/staff-client";
import { OpsShell } from "@/components/layout/ops-shell";
import { canManageLibrary } from "@/lib/auth/session";
import { requireOpsContext } from "@/lib/ops-page";

export default async function StaffPage() {
  const { supabase, profile } = await requireOpsContext();

  let staffQ = supabase
    .from("staff_members")
    .select(
      "id, full_name, staff_code, phone, email, role_title, address, status, notes",
    )
    .order("full_name")
    .limit(400);
  let branchesQ = supabase
    .from("branches")
    .select("id, name, vendor_id")
    .order("name");

  if (profile.vendor_id) {
    staffQ = staffQ.eq("vendor_id", profile.vendor_id);
    branchesQ = branchesQ.eq("vendor_id", profile.vendor_id);
  }
  if (profile.branch_id) {
    staffQ = staffQ.eq("branch_id", profile.branch_id);
  }

  const [{ data: staff }, { data: branches }] = await Promise.all([
    staffQ,
    branchesQ,
  ]);

  const vendorId = profile.vendor_id || branches?.[0]?.vendor_id || "";
  const branchId = profile.branch_id || branches?.[0]?.id || "";

  return (
    <OpsShell
      profile={profile}
      title="Staff"
      subtitle="Add staff details — staff can also borrow library books"
    >
      <StaffClient
        vendorId={vendorId}
        branchId={branchId}
        staff={staff ?? []}
        canManage={canManageLibrary(profile.role)}
      />
    </OpsShell>
  );
}
