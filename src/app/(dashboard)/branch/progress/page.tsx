import { ProgressClient } from "@/components/progress/progress-client";
import { canLogProgress } from "@/lib/auth/session";
import { OpsShell } from "@/components/layout/ops-shell";
import { requireOpsContext } from "@/lib/ops-page";

export default async function ProgressPage() {
  const { supabase, profile } = await requireOpsContext();

  let studentsQ = supabase
    .from("students")
    .select("id, full_name, admission_no")
    .eq("status", "active")
    .order("full_name")
    .limit(300);
  let classesQ = supabase
    .from("classes")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  let logsQ = supabase
    .from("islamic_progress_logs")
    .select(
      "id, student_id, stream, hifz_component, lesson_label, pages_or_ayah, quality_note, logged_on",
    )
    .order("logged_on", { ascending: false })
    .limit(80);

  if (profile.vendor_id) {
    studentsQ = studentsQ.eq("vendor_id", profile.vendor_id);
    classesQ = classesQ.eq("vendor_id", profile.vendor_id);
    logsQ = logsQ.eq("vendor_id", profile.vendor_id);
  }
  if (profile.branch_id) {
    studentsQ = studentsQ.eq("branch_id", profile.branch_id);
    classesQ = classesQ.eq("branch_id", profile.branch_id);
    logsQ = logsQ.eq("branch_id", profile.branch_id);
  }

  const [{ data: students }, { data: classes }, { data: logs }] =
    await Promise.all([studentsQ, classesQ, logsQ]);

  const nameById = new Map((students ?? []).map((s) => [s.id, s.full_name]));

  return (
    <OpsShell profile={profile} title="Islamic progress">
      <ProgressClient
        students={students ?? []}
        classes={classes ?? []}
        logs={(logs ?? []).map((l) => ({
          id: l.id,
          student_id: l.student_id,
          stream: l.stream,
          hifz_component: l.hifz_component,
          lesson_label: l.lesson_label,
          pages_or_ayah: l.pages_or_ayah,
          quality_note: l.quality_note,
          logged_on: l.logged_on,
          student_name: nameById.get(l.student_id),
        }))}
        canLog={canLogProgress(profile.role)}
      />
    </OpsShell>
  );
}
