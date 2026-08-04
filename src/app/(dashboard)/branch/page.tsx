import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { BranchOpsClient } from "@/components/operations/branch-ops-client";

export default async function BranchOpsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[branch] profile", profileError.message);
  }

  if (!profile || profile.status !== "active") {
    redirect("/login?error=inactive");
  }

  const vendorId = profile.vendor_id;
  const branchId = profile.branch_id;

  let branchesQuery = supabase
    .from("branches")
    .select("id, name, vendor_id")
    .order("name");
  if (vendorId) branchesQuery = branchesQuery.eq("vendor_id", vendorId);

  let studentsQuery = supabase
    .from("students")
    .select("id, full_name, admission_no, guardian_phone, status, branch_id")
    .eq("status", "active")
    .order("full_name")
    .limit(200);
  if (vendorId) studentsQuery = studentsQuery.eq("vendor_id", vendorId);
  if (branchId) studentsQuery = studentsQuery.eq("branch_id", branchId);

  let duesQuery = supabase
    .from("fee_dues")
    .select(
      "id, student_id, total_due, amount_paid, status, due_month, due_year, branch_id",
    )
    .neq("status", "paid")
    .order("due_year", { ascending: false })
    .limit(200);
  if (vendorId) duesQuery = duesQuery.eq("vendor_id", vendorId);
  if (branchId) duesQuery = duesQuery.eq("branch_id", branchId);

  let paymentsQuery = supabase
    .from("payments")
    .select(
      "id, amount, status, method, student_id, created_at, accountant_remarks, principal_remarks",
    )
    .in("status", ["pending_accountant", "pending_principal"])
    .order("created_at", { ascending: true });
  if (vendorId) paymentsQuery = paymentsQuery.eq("vendor_id", vendorId);
  if (branchId) paymentsQuery = paymentsQuery.eq("branch_id", branchId);

  let donationsQuery = supabase
    .from("donations")
    .select("id, amount, status, type, donor_name, created_at")
    .in("status", ["pending_accountant", "pending_principal"])
    .order("created_at", { ascending: true });
  if (vendorId) donationsQuery = donationsQuery.eq("vendor_id", vendorId);
  if (branchId) donationsQuery = donationsQuery.eq("branch_id", branchId);

  const [
    { data: branches, error: branchesError },
    { data: students, error: studentsError },
    { data: dues, error: duesError },
    { data: payments, error: paymentsError },
    { data: donations, error: donationsError },
  ] = await Promise.all([
    branchesQuery,
    studentsQuery,
    duesQuery,
    paymentsQuery,
    donationsQuery,
  ]);

  if (branchesError) console.error("[branch] branches", branchesError.message);
  if (studentsError) console.error("[branch] students", studentsError.message);
  if (duesError) console.error("[branch] dues", duesError.message);
  if (paymentsError) console.error("[branch] payments", paymentsError.message);
  if (donationsError) console.error("[branch] donations", donationsError.message);

  const homeHref =
    profile.role === "super_admin"
      ? "/super-admin"
      : profile.role === "vendor_admin"
        ? "/vendor"
        : "/branch";
  const homeLabel =
    profile.role === "super_admin"
      ? "Platform"
      : profile.role === "vendor_admin"
        ? "Vendor dashboard"
        : "Operations";

  return (
    <AppShell
      profile={profile}
      title="Branch operations"
      nav={[
        { href: "/branch", label: "Operations" },
        ...(profile.role === "vendor_admin"
          ? [{ href: "/vendor", label: "Vendor" }]
          : []),
        ...(profile.role === "super_admin"
          ? [{ href: "/super-admin", label: "Platform" }]
          : []),
      ]}
    >
      <BranchOpsClient
        role={profile.role}
        vendorId={vendorId}
        defaultBranchId={branchId}
        homeHref={homeHref}
        homeLabel={homeLabel}
        branches={branches ?? []}
        students={(students ?? []).map((s) => ({
          id: s.id,
          full_name: s.full_name,
          admission_no: s.admission_no,
        }))}
        dues={(dues ?? []).map((d) => ({
          id: d.id,
          student_id: d.student_id,
          total_due: Number(d.total_due),
          amount_paid: Number(d.amount_paid),
          due_month: d.due_month,
          due_year: d.due_year,
          branch_id: d.branch_id,
        }))}
        payments={(payments ?? []).map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          status: p.status,
          method: p.method,
          student_id: p.student_id,
          created_at: p.created_at,
        }))}
        donations={(donations ?? []).map((d) => ({
          id: d.id,
          amount: Number(d.amount),
          status: d.status,
          type: d.type,
          donor_name: d.donor_name,
          created_at: d.created_at,
        }))}
      />
    </AppShell>
  );
}
