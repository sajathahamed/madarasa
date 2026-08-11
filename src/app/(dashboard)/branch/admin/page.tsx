import { redirect } from "next/navigation";

import { AdminOpsClient } from "@/components/admin/admin-ops-client";
import { OpsShell } from "@/components/layout/ops-shell";
import { canManageAdminOps } from "@/lib/auth/session";
import { requireOpsContext } from "@/lib/ops-page";

export default async function BranchAdminPage() {
  const { supabase, profile } = await requireOpsContext();

  if (!canManageAdminOps(profile.role)) {
    redirect("/branch");
  }

  let paymentsQ = supabase
    .from("payments")
    .select("id, amount, status, method, created_at, student_id")
    .order("created_at", { ascending: false })
    .limit(100);
  let donationsQ = supabase
    .from("donations")
    .select("id, amount, status, donor_name, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  let studentsQ = supabase
    .from("students")
    .select("id, full_name, admission_no, status, guardian_phone")
    .order("full_name")
    .limit(300);
  let duesQ = supabase
    .from("fee_dues")
    .select(
      "id, due_month, due_year, total_due, amount_paid, status, student_id",
    )
    .order("due_year", { ascending: false })
    .limit(150);
  let sessionsQ = supabase
    .from("attendance_sessions")
    .select("id, session_date, class_id")
    .order("session_date", { ascending: false })
    .limit(80);
  let progressQ = supabase
    .from("islamic_progress_logs")
    .select("id, logged_on, stream, student_id, lesson_label")
    .order("logged_on", { ascending: false })
    .limit(80);
  let classesQ = supabase.from("classes").select("id, name").order("name").limit(100);

  if (profile.vendor_id) {
    paymentsQ = paymentsQ.eq("vendor_id", profile.vendor_id);
    donationsQ = donationsQ.eq("vendor_id", profile.vendor_id);
    studentsQ = studentsQ.eq("vendor_id", profile.vendor_id);
    duesQ = duesQ.eq("vendor_id", profile.vendor_id);
    sessionsQ = sessionsQ.eq("vendor_id", profile.vendor_id);
    progressQ = progressQ.eq("vendor_id", profile.vendor_id);
    classesQ = classesQ.eq("vendor_id", profile.vendor_id);
  }
  if (profile.branch_id) {
    paymentsQ = paymentsQ.eq("branch_id", profile.branch_id);
    donationsQ = donationsQ.eq("branch_id", profile.branch_id);
    studentsQ = studentsQ.eq("branch_id", profile.branch_id);
    duesQ = duesQ.eq("branch_id", profile.branch_id);
    sessionsQ = sessionsQ.eq("branch_id", profile.branch_id);
    progressQ = progressQ.eq("branch_id", profile.branch_id);
    classesQ = classesQ.eq("branch_id", profile.branch_id);
  }

  const [
    { data: payments },
    { data: donations },
    { data: students },
    { data: dues },
    { data: sessions },
    { data: progress },
    { data: classes },
  ] = await Promise.all([
    paymentsQ,
    donationsQ,
    studentsQ,
    duesQ,
    sessionsQ,
    progressQ,
    classesQ,
  ]);

  const studentIds = [
    ...new Set([
      ...(payments ?? []).map((p) => p.student_id),
      ...(dues ?? []).map((d) => d.student_id),
      ...(progress ?? []).map((p) => p.student_id),
    ]),
  ];
  const classIds = [
    ...new Set((sessions ?? []).map((s) => s.class_id).filter(Boolean)),
  ] as string[];

  const nameById = new Map((students ?? []).map((s) => [s.id, s.full_name]));
  const admissionById = new Map(
    (students ?? []).map((s) => [s.id, s.admission_no]),
  );

  if (studentIds.length > 0) {
    const missing = studentIds.filter((id) => !nameById.has(id));
    if (missing.length > 0) {
      const { data: extra } = await supabase
        .from("students")
        .select("id, full_name, admission_no")
        .in("id", missing);
      for (const s of extra ?? []) {
        nameById.set(s.id, s.full_name);
        admissionById.set(s.id, s.admission_no);
      }
    }
  }

  const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));
  if (classIds.length > 0) {
    const missing = classIds.filter((id) => !classNameById.has(id));
    if (missing.length > 0) {
      const { data: extra } = await supabase
        .from("classes")
        .select("id, name")
        .in("id", missing);
      for (const c of extra ?? []) classNameById.set(c.id, c.name);
    }
  }

  return (
    <OpsShell
      profile={profile}
      title="Admin"
      subtitle="Delete mistaken payments, dues, students, and other records"
    >
      <AdminOpsClient
        payments={(payments ?? []).map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          status: p.status,
          method: p.method,
          created_at: p.created_at,
          student_name: nameById.get(p.student_id),
          admission_no: admissionById.get(p.student_id),
        }))}
        donations={(donations ?? []).map((d) => ({
          id: d.id,
          amount: Number(d.amount),
          status: d.status,
          donor_name: d.donor_name,
          created_at: d.created_at,
        }))}
        students={students ?? []}
        dues={(dues ?? []).map((d) => ({
          id: d.id,
          due_month: d.due_month,
          due_year: d.due_year,
          total_due: Number(d.total_due),
          amount_paid: Number(d.amount_paid),
          status: d.status,
          student_name: nameById.get(d.student_id),
          admission_no: admissionById.get(d.student_id),
        }))}
        attendanceSessions={(sessions ?? []).map((s) => ({
          id: s.id,
          session_date: s.session_date,
          class_name: classNameById.get(s.class_id) || undefined,
        }))}
        progressLogs={(progress ?? []).map((p) => ({
          id: p.id,
          logged_at: p.logged_on,
          stream: p.stream,
          lesson_ref: p.lesson_label,
          student_name: nameById.get(p.student_id),
        }))}
        classes={classes ?? []}
      />
    </OpsShell>
  );
}
