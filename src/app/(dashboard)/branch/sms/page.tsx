import { redirect } from "next/navigation";

import { SendSmsClient } from "@/components/sms/send-sms-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OpsShell } from "@/components/layout/ops-shell";
import { canSendSms } from "@/lib/auth/session";
import { notificationStatus } from "@/lib/notify";
import { requireOpsContext } from "@/lib/ops-page";
import type { AcademicSection } from "@/types/database";

export default async function SendSmsPage() {
  const { supabase, profile } = await requireOpsContext();

  if (!canSendSms(profile.role)) {
    redirect("/branch");
  }

  const notify = notificationStatus();

  let studentsQ = supabase
    .from("students")
    .select("id, full_name, admission_no, guardian_phone, status")
    .eq("status", "active")
    .order("full_name")
    .limit(400);

  let staffQ = supabase
    .from("staff_members")
    .select("id, full_name, staff_code, phone, role_title, status")
    .eq("status", "active")
    .order("full_name")
    .limit(400);

  let classesQ = supabase
    .from("classes")
    .select("id, name, section, grade")
    .eq("is_active", true)
    .order("name");

  if (profile.vendor_id) {
    studentsQ = studentsQ.eq("vendor_id", profile.vendor_id);
    staffQ = staffQ.eq("vendor_id", profile.vendor_id);
    classesQ = classesQ.eq("vendor_id", profile.vendor_id);
  }
  if (profile.branch_id) {
    studentsQ = studentsQ.eq("branch_id", profile.branch_id);
    staffQ = staffQ.eq("branch_id", profile.branch_id);
    classesQ = classesQ.eq("branch_id", profile.branch_id);
  }

  const [{ data: students }, { data: staff }, { data: classes }] =
    await Promise.all([studentsQ, staffQ, classesQ]);

  const studentIds = (students ?? []).map((s) => s.id);
  const classById = new Map(
    (classes ?? []).map((c) => [
      c.id,
      {
        id: c.id,
        name: c.name,
        section: c.section as AcademicSection | null,
        grade: c.grade,
      },
    ]),
  );

  const classIdByStudent = new Map<string, string>();
  if (studentIds.length > 0) {
    const { data: enrollments } = await supabase
      .from("class_enrollments")
      .select("student_id, class_id")
      .in("student_id", studentIds)
      .eq("is_active", true);
    for (const e of enrollments ?? []) {
      if (classById.has(e.class_id)) {
        classIdByStudent.set(e.student_id, e.class_id);
      }
    }
  }

  return (
    <OpsShell profile={profile} title="Send SMS">
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Send SMS</CardTitle>
          <CardDescription>
            Send to active students or staff in bulk, or enter custom name and
            phone rows. Messages go via Dialog Rich Communication (mask Upview
            Tech).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SendSmsClient
            configured={notify.dialogConfigured}
            mask={notify.smsMask}
            students={(students ?? []).map((s) => {
              const classId = classIdByStudent.get(s.id) ?? null;
              const klass = classId ? classById.get(classId) : null;
              return {
                id: s.id,
                full_name: s.full_name,
                admission_no: s.admission_no,
                guardian_phone: s.guardian_phone || "",
                class_id: classId,
                class_name: klass?.name ?? null,
                section: klass?.section ?? null,
                grade: klass?.grade ?? null,
              };
            })}
            staff={(staff ?? []).map((s) => ({
              id: s.id,
              full_name: s.full_name,
              staff_code: s.staff_code,
              phone: s.phone || "",
              role_title: s.role_title,
            }))}
            classes={(classes ?? []).map((c) => ({
              id: c.id,
              name: c.name,
              section: c.section as AcademicSection | null,
              grade: c.grade,
            }))}
          />
        </CardContent>
      </Card>
    </OpsShell>
  );
}
