import { ClassesClient } from "@/components/classes/classes-client";
import { canEnrollStudents, canManageClasses } from "@/lib/auth/session";
import { OpsShell } from "@/components/layout/ops-shell";
import { requireOpsContext } from "@/lib/ops-page";

export default async function ClassesPage() {
  const { supabase, profile } = await requireOpsContext();

  let classesQ = supabase
    .from("classes")
    .select("id, name, section, grade, schedule_note, branch_id")
    .eq("is_active", true)
    .order("name");
  let studentsQ = supabase
    .from("students")
    .select("id, full_name, admission_no")
    .eq("status", "active")
    .order("full_name")
    .limit(300);
  let branchesQ = supabase.from("branches").select("id, name, vendor_id").order("name");

  if (profile.vendor_id) {
    classesQ = classesQ.eq("vendor_id", profile.vendor_id);
    studentsQ = studentsQ.eq("vendor_id", profile.vendor_id);
    branchesQ = branchesQ.eq("vendor_id", profile.vendor_id);
  }
  if (profile.branch_id) {
    classesQ = classesQ.eq("branch_id", profile.branch_id);
    studentsQ = studentsQ.eq("branch_id", profile.branch_id);
  }

  const [{ data: classes }, { data: students }, { data: branches }] =
    await Promise.all([classesQ, studentsQ, branchesQ]);

  const classIds = (classes ?? []).map((c) => c.id);
  let enrollments: {
    id: string;
    class_id: string;
    student_id: string;
    is_active: boolean;
    student_name?: string;
  }[] = [];

  if (classIds.length > 0) {
    const { data } = await supabase
      .from("class_enrollments")
      .select("id, class_id, student_id, is_active")
      .in("class_id", classIds)
      .eq("is_active", true);
    const ids = [...new Set((data ?? []).map((e) => e.student_id))];
    const { data: st } =
      ids.length > 0
        ? await supabase.from("students").select("id, full_name").in("id", ids)
        : { data: [] as { id: string; full_name: string }[] };
    const byId = new Map((st ?? []).map((s) => [s.id, s.full_name]));
    enrollments = (data ?? []).map((e) => ({
      ...e,
      student_name: byId.get(e.student_id),
    }));
  }

  const vendorId = profile.vendor_id || branches?.[0]?.vendor_id || "";
  const branchId = profile.branch_id || branches?.[0]?.id || "";

  return (
    <OpsShell profile={profile} title="Classes">
      <ClassesClient
        vendorId={vendorId}
        branchId={branchId}
        classes={classes ?? []}
        students={students ?? []}
        enrollments={enrollments}
        canManage={canManageClasses(profile.role)}
        canEnroll={canEnrollStudents(profile.role)}
      />
    </OpsShell>
  );
}
