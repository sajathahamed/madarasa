import { FeeCashDrawer } from "@/components/fees/fee-cash-drawer";
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
  const tomorrowStart = new Date(
    year,
    month - 1,
    now.getDate() + 1,
  ).toISOString();
  const monthLabel = now.toLocaleString("en", {
    month: "short",
    year: "numeric",
  });

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
  let recentPaymentsQ = supabase
    .from("payments")
    .select(
      "id, student_id, amount, status, method, created_at, recorded_by, bank_reference",
    )
    .order("created_at", { ascending: false })
    .limit(300);
  let branchesQ = supabase
    .from("branches")
    .select("id, vendor_id")
    .order("name");
  // Cash-on-hand inputs (no invented opening balance):
  // approved cash payments − fee_cash_outs − cash expenses
  let cashPaymentsQ = supabase
    .from("payments")
    .select("amount, created_at, status, method")
    .eq("status", "approved")
    .eq("method", "cash")
    .limit(5000);
  let cashOutsQ = supabase
    .from("fee_cash_outs")
    .select("id, amount, reason, notes, cashed_out_at, cashed_out_by")
    .order("cashed_out_at", { ascending: false })
    .limit(200);
  let cashExpensesQ = supabase
    .from("expenses")
    .select("amount")
    .eq("payment_method", "cash")
    .limit(5000);

  if (profile.vendor_id) {
    studentsQ = studentsQ.eq("vendor_id", profile.vendor_id);
    duesQ = duesQ.eq("vendor_id", profile.vendor_id);
    recentPaymentsQ = recentPaymentsQ.eq("vendor_id", profile.vendor_id);
    branchesQ = branchesQ.eq("vendor_id", profile.vendor_id);
    cashPaymentsQ = cashPaymentsQ.eq("vendor_id", profile.vendor_id);
    cashOutsQ = cashOutsQ.eq("vendor_id", profile.vendor_id);
    cashExpensesQ = cashExpensesQ.eq("vendor_id", profile.vendor_id);
  }
  if (profile.branch_id) {
    studentsQ = studentsQ.eq("branch_id", profile.branch_id);
    duesQ = duesQ.eq("branch_id", profile.branch_id);
    recentPaymentsQ = recentPaymentsQ.eq("branch_id", profile.branch_id);
    cashPaymentsQ = cashPaymentsQ.eq("branch_id", profile.branch_id);
    cashOutsQ = cashOutsQ.eq("branch_id", profile.branch_id);
    cashExpensesQ = cashExpensesQ.eq("branch_id", profile.branch_id);
  }

  const [
    { data: students },
    { data: dues },
    { data: recentPayments },
    { data: branches },
    { data: cashPayments },
    { data: cashOuts },
    { data: cashExpenses },
  ] = await Promise.all([
    studentsQ,
    duesQ,
    recentPaymentsQ,
    branchesQ,
    cashPaymentsQ,
    cashOutsQ,
    cashExpensesQ,
  ]);

  const vendorId = profile.vendor_id || branches?.[0]?.vendor_id || "";
  const branchId = profile.branch_id || branches?.[0]?.id || "";

  const nameById = new Map((students ?? []).map((s) => [s.id, s.full_name]));
  const admissionById = new Map(
    (students ?? []).map((s) => [s.id, s.admission_no]),
  );
  const phoneById = new Map(
    (students ?? []).map((s) => [s.id, s.guardian_phone]),
  );

  const paymentStudentIds = [
    ...new Set((recentPayments ?? []).map((p) => p.student_id)),
  ];
  const missingIds = [
    ...new Set(
      [...(dues ?? []).map((d) => d.student_id), ...paymentStudentIds].filter(
        (id) => !nameById.has(id),
      ),
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

  const recorderIds = [
    ...new Set(
      (recentPayments ?? []).map((p) => p.recorded_by).filter(Boolean),
    ),
  ] as string[];
  const cashOutUserIds = [
    ...new Set((cashOuts ?? []).map((c) => c.cashed_out_by).filter(Boolean)),
  ] as string[];
  const userIds = [...new Set([...recorderIds, ...cashOutUserIds])];
  const userName = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("app_users")
      .select("id, full_name")
      .in("id", userIds);
    for (const u of users ?? []) {
      userName.set(u.id, u.full_name);
    }
  }

  const openDues = dues ?? [];
  const outstandingTotal = openDues.reduce(
    (sum, d) => sum + Math.max(0, Number(d.total_due) - Number(d.amount_paid)),
    0,
  );

  const payments = recentPayments ?? [];
  const monthPayments = payments.filter(
    (p) => p.created_at >= monthStart && p.created_at < nextMonthStart,
  );
  const monthApproved = monthPayments.filter((p) => p.status === "approved");
  const monthPending = monthPayments.filter(
    (p) =>
      p.status === "pending_accountant" || p.status === "pending_principal",
  );
  const todayApproved = monthApproved.filter(
    (p) => p.created_at >= todayStart && p.created_at < tomorrowStart,
  );

  // Today’s collections: all approved payments today from the recent list.
  const todayCollectionsFromAllMethods = todayApproved.reduce(
    (s, p) => s + Number(p.amount),
    0,
  );

  const approvedCashTotal = (cashPayments ?? []).reduce(
    (s, p) => s + Number(p.amount),
    0,
  );
  const cashOutsTotal = (cashOuts ?? []).reduce(
    (s, p) => s + Number(p.amount),
    0,
  );
  const cashExpensesTotal = (cashExpenses ?? []).reduce(
    (s, p) => s + Number(p.amount),
    0,
  );
  const cashOnHand = approvedCashTotal - cashOutsTotal - cashExpensesTotal;

  const paymentRows = payments.map((p) => {
    const note = p.bank_reference?.startsWith("Excel paid by:")
      ? p.bank_reference
      : null;
    return {
      id: p.id,
      student_id: p.student_id,
      amount: Number(p.amount),
      status: p.status,
      method: p.method,
      created_at: p.created_at,
      recorded_by_name: userName.get(p.recorded_by) ?? null,
      paid_by_note: note,
      student_name: nameById.get(p.student_id),
      admission_no: admissionById.get(p.student_id),
    };
  });

  const canGenerate = [
    "super_admin",
    "vendor_admin",
    "accountant",
    "principal",
  ].includes(profile.role);
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
      subtitle="Record payments (applied instantly), cash out from the till, search pending dues"
    >
      <div className="space-y-8">
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
          payments={paymentRows}
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
            todayApprovedTotal: todayCollectionsFromAllMethods,
            monthLabel,
          }}
        />

        <FeeCashDrawer
          vendorId={vendorId}
          branchId={branchId}
          canRecord={canEnterData(profile.role)}
          summary={{
            todayCollectionsTotal: todayCollectionsFromAllMethods,
            approvedCashTotal,
            cashOutsTotal,
            cashExpensesTotal,
            cashOnHand,
          }}
          history={(cashOuts ?? []).map((c) => ({
            id: c.id,
            amount: Number(c.amount),
            reason: c.reason,
            notes: c.notes,
            cashed_out_at: c.cashed_out_at,
            cashed_out_by_name: userName.get(c.cashed_out_by) ?? null,
          }))}
        />
      </div>
    </OpsShell>
  );
}
