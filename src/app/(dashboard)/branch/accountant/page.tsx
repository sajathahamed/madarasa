import { AccountantDeskClient } from "@/components/accountant/accountant-desk-client";
import { OpsShell } from "@/components/layout/ops-shell";
import { requireOpsContext } from "@/lib/ops-page";

export default async function AccountantDeskPage() {
  const { supabase, profile } = await requireOpsContext();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  let paymentsQ = supabase
    .from("payments")
    .select("id, amount, status, method, student_id, created_at")
    .eq("status", "pending_accountant")
    .order("created_at", { ascending: true });
  let donationsQ = supabase
    .from("donations")
    .select("id, amount, status, type, donor_name, created_at")
    .eq("status", "pending_accountant")
    .order("created_at", { ascending: true });
  let duesQ = supabase
    .from("fee_dues")
    .select(
      "id, student_id, due_month, due_year, month_amount, carried_forward, total_due, amount_paid, status",
    )
    .neq("status", "paid")
    .order("due_year", { ascending: false })
    .order("due_month", { ascending: false })
    .limit(200);
  let approvedQ = supabase
    .from("payments")
    .select("id, amount, method, student_id, created_at")
    .eq("status", "approved")
    .gte("created_at", monthStart)
    .lt("created_at", nextMonth)
    .order("created_at", { ascending: false })
    .limit(20);

  // Principal sees pending_principal too when visiting this desk
  if (profile.role === "principal") {
    paymentsQ = supabase
      .from("payments")
      .select("id, amount, status, method, student_id, created_at")
      .eq("status", "pending_principal")
      .order("created_at", { ascending: true });
    donationsQ = supabase
      .from("donations")
      .select("id, amount, status, type, donor_name, created_at")
      .eq("status", "pending_principal")
      .order("created_at", { ascending: true });
  }
  if (["super_admin", "vendor_admin"].includes(profile.role)) {
    paymentsQ = supabase
      .from("payments")
      .select("id, amount, status, method, student_id, created_at")
      .in("status", ["pending_accountant", "pending_principal"])
      .order("created_at", { ascending: true });
    donationsQ = supabase
      .from("donations")
      .select("id, amount, status, type, donor_name, created_at")
      .in("status", ["pending_accountant", "pending_principal"])
      .order("created_at", { ascending: true });
  }

  if (profile.vendor_id) {
    paymentsQ = paymentsQ.eq("vendor_id", profile.vendor_id);
    donationsQ = donationsQ.eq("vendor_id", profile.vendor_id);
    duesQ = duesQ.eq("vendor_id", profile.vendor_id);
    approvedQ = approvedQ.eq("vendor_id", profile.vendor_id);
  }
  if (profile.branch_id) {
    paymentsQ = paymentsQ.eq("branch_id", profile.branch_id);
    donationsQ = donationsQ.eq("branch_id", profile.branch_id);
    duesQ = duesQ.eq("branch_id", profile.branch_id);
    approvedQ = approvedQ.eq("branch_id", profile.branch_id);
  }

  const [
    { data: payments },
    { data: donations },
    { data: dues },
    { data: approved },
  ] = await Promise.all([paymentsQ, donationsQ, duesQ, approvedQ]);

  const studentIds = [
    ...new Set([
      ...(payments ?? []).map((p) => p.student_id),
      ...(dues ?? []).map((d) => d.student_id),
      ...(approved ?? []).map((p) => p.student_id),
    ]),
  ];

  const { data: students } =
    studentIds.length > 0
      ? await supabase
          .from("students")
          .select("id, full_name, admission_no")
          .in("id", studentIds)
      : { data: [] as { id: string; full_name: string; admission_no: string }[] };

  const byId = new Map((students ?? []).map((s) => [s.id, s]));

  const dueRows = (dues ?? []).map((d) => ({
    id: d.id,
    student_id: d.student_id,
    student_name: byId.get(d.student_id)?.full_name,
    admission_no: byId.get(d.student_id)?.admission_no,
    due_month: d.due_month,
    due_year: d.due_year,
    month_amount: Number(d.month_amount),
    carried_forward: Number(d.carried_forward),
    total_due: Number(d.total_due),
    amount_paid: Number(d.amount_paid),
    status: d.status,
  }));

  const outstandingTotal = dueRows.reduce(
    (s, d) => s + (d.total_due - d.amount_paid),
    0,
  );
  const carriedTotal = dueRows.reduce((s, d) => s + d.carried_forward, 0);
  const collectedMonth = (approved ?? []).reduce(
    (s, p) => s + Number(p.amount),
    0,
  );

  return (
    <OpsShell
      profile={profile}
      title="Accountant desk"
      subtitle="Approvals · carry-forward · collection"
    >
      <AccountantDeskClient
        role={profile.role}
        pendingPayments={(payments ?? []).map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          status: p.status,
          method: p.method,
          student_id: p.student_id,
          student_name: byId.get(p.student_id)?.full_name,
          admission_no: byId.get(p.student_id)?.admission_no,
          created_at: p.created_at,
        }))}
        pendingDonations={(donations ?? []).map((d) => ({
          id: d.id,
          amount: Number(d.amount),
          status: d.status,
          type: d.type,
          donor_name: d.donor_name,
          created_at: d.created_at,
        }))}
        dues={dueRows}
        approvedRecent={(approved ?? []).map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          method: p.method,
          student_name: byId.get(p.student_id)?.full_name,
          created_at: p.created_at,
        }))}
        kpis={{
          pendingCount: (payments?.length ?? 0) + (donations?.length ?? 0),
          outstandingTotal,
          carriedTotal,
          collectedMonth,
          unpaidStudents: new Set(dueRows.map((d) => d.student_id)).size,
        }}
      />
    </OpsShell>
  );
}
