import { FeesOfficeClient } from "@/components/fees/fees-office-client";
import { OpsShell } from "@/components/layout/ops-shell";
import { requireOpsContext } from "@/lib/ops-page";

export default async function FeesPage() {
  const { supabase, profile } = await requireOpsContext();

  let studentsQ = supabase
    .from("students")
    .select("id, full_name, admission_no")
    .eq("status", "active")
    .order("full_name")
    .limit(500);
  let duesQ = supabase
    .from("fee_dues")
    .select(
      "id, student_id, total_due, amount_paid, due_month, due_year, status, month_amount, carried_forward",
    )
    .neq("status", "paid")
    .order("due_year", { ascending: false })
    .limit(500);

  if (profile.vendor_id) {
    studentsQ = studentsQ.eq("vendor_id", profile.vendor_id);
    duesQ = duesQ.eq("vendor_id", profile.vendor_id);
  }
  if (profile.branch_id) {
    studentsQ = studentsQ.eq("branch_id", profile.branch_id);
    duesQ = duesQ.eq("branch_id", profile.branch_id);
  }

  const [{ data: students }, { data: dues }] = await Promise.all([
    studentsQ,
    duesQ,
  ]);

  const nameById = new Map((students ?? []).map((s) => [s.id, s.full_name]));
  const admissionById = new Map(
    (students ?? []).map((s) => [s.id, s.admission_no]),
  );
  const missingIds = [
    ...new Set(
      (dues ?? [])
        .map((d) => d.student_id)
        .filter((id) => !nameById.has(id)),
    ),
  ];
  if (missingIds.length > 0) {
    const { data: extra } = await supabase
      .from("students")
      .select("id, full_name, admission_no")
      .in("id", missingIds);
    for (const s of extra ?? []) {
      nameById.set(s.id, s.full_name);
      admissionById.set(s.id, s.admission_no);
    }
  }

  const canGenerate = ["super_admin", "vendor_admin", "accountant", "principal"].includes(
    profile.role,
  );
  const canRemind = [
    "super_admin",
    "vendor_admin",
    "accountant",
    "principal",
    "data_entry",
  ].includes(profile.role);

  return (
    <OpsShell profile={profile} title="Fees">
      <FeesOfficeClient
        students={students ?? []}
        dues={(dues ?? []).map((d) => ({
          id: d.id,
          student_id: d.student_id,
          total_due: Number(d.total_due),
          amount_paid: Number(d.amount_paid),
          due_month: d.due_month,
          due_year: d.due_year,
          status: d.status,
          month_amount: Number(d.month_amount),
          carried_forward: Number(d.carried_forward),
          student_name: nameById.get(d.student_id),
          admission_no: admissionById.get(d.student_id),
        }))}
        canGenerate={canGenerate}
        canRemind={canRemind}
      />
    </OpsShell>
  );
}
