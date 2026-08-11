import { notFound } from "next/navigation";

import { StudentProfileClient } from "@/components/students/student-profile-client";
import { canEditStudent } from "@/lib/auth/session";
import { OpsShell } from "@/components/layout/ops-shell";
import { requireOpsContext } from "@/lib/ops-page";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, profile } = await requireOpsContext();

  const { data: student } = await supabase
    .from("students")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!student) notFound();

  const [{ data: health }, { data: feePlan }, { data: dues }, { data: payments }] =
    await Promise.all([
      supabase
        .from("student_health_info")
        .select("*")
        .eq("student_id", id)
        .maybeSingle(),
      supabase
        .from("student_fee_plans")
        .select("*")
        .eq("student_id", id)
        .eq("is_current", true)
        .maybeSingle(),
      supabase
        .from("fee_dues")
        .select("*")
        .eq("student_id", id)
        .order("due_year", { ascending: false })
        .order("due_month", { ascending: false })
        .limit(24),
      supabase
        .from("payments")
        .select("id, amount, status, method, created_at")
        .eq("student_id", id)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  return (
    <OpsShell profile={profile} title={student.full_name}>
      <StudentProfileClient
        student={student}
        health={health}
        feePlan={feePlan}
        dues={(dues ?? []).map((d) => ({
          id: d.id,
          due_month: d.due_month,
          due_year: d.due_year,
          total_due: Number(d.total_due),
          amount_paid: Number(d.amount_paid),
          status: d.status,
          month_amount: Number(d.month_amount),
          carried_forward: Number(d.carried_forward),
        }))}
        payments={(payments ?? []).map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          status: p.status,
          method: p.method,
          created_at: p.created_at,
        }))}
        canEdit={canEditStudent(profile.role)}
      />
    </OpsShell>
  );
}
