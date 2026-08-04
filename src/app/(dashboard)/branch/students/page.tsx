import { CreateStudentForm } from "@/components/operations/create-student-form";
import { StudentDirectory } from "@/components/students/student-directory";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canEnterData } from "@/lib/auth/session";
import { OpsShell } from "@/components/layout/ops-shell";
import { requireOpsContext } from "@/lib/ops-page";

export default async function StudentsPage() {
  const { supabase, profile } = await requireOpsContext();

  let query = supabase
    .from("students")
    .select("id, full_name, admission_no, guardian_phone, status, branch_id")
    .order("full_name")
    .limit(500);

  if (profile.vendor_id) query = query.eq("vendor_id", profile.vendor_id);
  if (profile.branch_id) query = query.eq("branch_id", profile.branch_id);

  let branchesQ = supabase.from("branches").select("id, name, vendor_id").order("name");
  if (profile.vendor_id) branchesQ = branchesQ.eq("vendor_id", profile.vendor_id);

  const [{ data: students }, { data: branches }] = await Promise.all([
    query,
    branchesQ,
  ]);

  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));
  const vendorId = profile.vendor_id || branches?.[0]?.vendor_id || "";
  const branchId = profile.branch_id || branches?.[0]?.id || "";

  return (
    <OpsShell profile={profile} title="Students">
      <div className="space-y-8">
        <StudentDirectory
          students={(students ?? []).map((s) => ({
            id: s.id,
            full_name: s.full_name,
            admission_no: s.admission_no,
            guardian_phone: s.guardian_phone,
            status: s.status,
            branch_name: branchName.get(s.branch_id),
          }))}
        />

        {canEnterData(profile.role) ? (
          <Card>
            <CardHeader>
              <CardTitle>Admit student</CardTitle>
              <CardDescription>
                Creates student, health info, and current fee plan together.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!profile.branch_id && (branches?.length ?? 0) > 1 ? (
                <p className="mb-3 text-sm text-[#5a6f65]">
                  Using branch “{branches?.[0]?.name}”. Open Branch ops with a
                  picker context from vendor dashboard if you need another.
                </p>
              ) : null}
              <CreateStudentForm vendorId={vendorId} branchId={branchId} />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </OpsShell>
  );
}
