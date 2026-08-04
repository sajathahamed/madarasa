import { AttendanceClient } from "@/components/attendance/attendance-client";
import { canMarkAttendance } from "@/lib/auth/session";
import { OpsShell } from "@/components/layout/ops-shell";
import { requireOpsContext } from "@/lib/ops-page";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const { class: classParam } = await searchParams;
  const { supabase, profile } = await requireOpsContext();

  let classesQ = supabase
    .from("classes")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  if (profile.vendor_id) classesQ = classesQ.eq("vendor_id", profile.vendor_id);
  if (profile.branch_id) classesQ = classesQ.eq("branch_id", profile.branch_id);

  const { data: classes } = await classesQ;
  const classIds = (classes ?? []).map((c) => c.id);

  const membersByClass: Record<
    string,
    { student_id: string; full_name: string; admission_no: string }[]
  > = {};

  if (classIds.length > 0) {
    const { data: enrollments } = await supabase
      .from("class_enrollments")
      .select("class_id, student_id")
      .in("class_id", classIds)
      .eq("is_active", true);

    const studentIds = [...new Set((enrollments ?? []).map((e) => e.student_id))];
    const { data: students } =
      studentIds.length > 0
        ? await supabase
            .from("students")
            .select("id, full_name, admission_no")
            .in("id", studentIds)
        : { data: [] as { id: string; full_name: string; admission_no: string }[] };

    const byId = new Map((students ?? []).map((s) => [s.id, s]));
    for (const e of enrollments ?? []) {
      const st = byId.get(e.student_id);
      if (!st) continue;
      if (!membersByClass[e.class_id]) membersByClass[e.class_id] = [];
      membersByClass[e.class_id].push({
        student_id: e.student_id,
        full_name: st.full_name,
        admission_no: st.admission_no,
      });
    }
  }

  return (
    <OpsShell profile={profile} title="Attendance">
      <AttendanceClient
        classes={classes ?? []}
        membersByClass={membersByClass}
        initialClassId={classParam}
        canMark={canMarkAttendance(profile.role)}
      />
    </OpsShell>
  );
}
