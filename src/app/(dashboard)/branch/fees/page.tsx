import { FeesOfficeClient } from "@/components/fees/fees-office-client";
import { OpsShell } from "@/components/layout/ops-shell";
import { canEnterData } from "@/lib/auth/session";
import { requireOpsContext } from "@/lib/ops-page";

export default async function FeesPage() {
  const { supabase, profile } = await requireOpsContext();

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthStart = new Date(year, month - 1, 1).toISOString();
  const nextMonthStart = new Date(year, month, 1).toISOString();
  const todayStart = new Date(year, month - 1, now.getDate()).toISOString();
  const tomorrowStart = new Date(year, month - 1, now.getDate() + 1).toISOString();
  const monthLabel = now.toLocaleString("en", { month: "short", year: "numeric" });

  let studentsQ = supabase
    .from("students")
    .select("id, full_name, admission_no, guardian_phone")
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
  let monthPaymentsQ = supabase
    .from("payments")
    .select("id, amount, status, created_at")
    .gte("created_at", monthStart)
    .lt("created_at", nextMonthStart)
    .limit(1000);

  if (profile.vendor_id) {
    studentsQ = studentsQ.eq("vendor_id", profile.vendor_id);
    duesQ = duesQ.eq("vendor_id", profile.vendor_id);
    monthPaymentsQ = monthPaymentsQ.eq("vendor_id", profile.vendor_id);
  }
  if (profile.branch_id) {
    studentsQ = studentsQ.eq("branch_id", profile.branch_id);
    duesQ = duesQ.eq("branch_id", profile.branch_id);
    monthPaymentsQ = monthPaymentsQ.eq("branch_id", profile.branch_id);
  }

  const [{ data: students }, { data: dues }, { data: monthPayments }] =
    await Promise.all([studentsQ, duesQ, monthPaymentsQ]);

  const nameById = new Map((students ?? []).map((s) => [s.id, s.full_name]));
  const admissionById = new Map(
    (students ?? []).map((s) => [s.id, s.admission_no]),
  );
  const phoneById = new Map(
    (students ?? []).map((s) => [s.id, s.guardian_phone]),
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
      .select("id, full_name, admission_no, guardian_phone")
      .in("id", missingIds);
    for (const s of extra ?? []) {
      nameById.set(s.id, s.full_name);
      admissionById.set(s.id, s.admission_no);
      phoneById.set(s.id, s.guardian_phone);
    }
  }

  const openDues = dues ?? [];
  const outstandingTotal = openDues.reduce(
    (sum, d) => sum + Math.max(0, Number(d.total_due) - Number(d.amount_paid)),
    0,
  );

  const payments = monthPayments ?? [];
  const monthApproved = payments.filter((p) => p.status === "approved");
  const monthPending = payments.filter(
    (p) =>
      p.status === "pending_accountant" || p.status === "pending_principal",
  );
  const todayApproved = monthApproved.filter(
    (p) => p.created_at >= todayStart && p.created_at < tomorrowStart,
  );

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
    <OpsShell
      profile={profile}
      title="Fees"
      subtitle="Record payments, search pending dues, SMS or WhatsApp remind"
    >
      <FeesOfficeClient
        students={students ?? []}
        dues={openDues.map((d) => ({
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
          guardian_phone: phoneById.get(d.student_id),
        }))}
        canGenerate={canGenerate}
        canRemind={canRemind}
        canRecord={canEnterData(profile.role)}
        summary={{
          outstandingTotal,
          unpaidCount: openDues.length,
          monthApprovedTotal: monthApproved.reduce(
            (s, p) => s + Number(p.amount),
            0,
          ),
          monthApprovedCount: monthApproved.length,
          monthPendingTotal: monthPending.reduce(
            (s, p) => s + Number(p.amount),
            0,
          ),
          monthPendingCount: monthPending.length,
          todayApprovedTotal: todayApproved.reduce(
            (s, p) => s + Number(p.amount),
            0,
          ),
          monthLabel,
        }}
      />
    </OpsShell>
  );
}
