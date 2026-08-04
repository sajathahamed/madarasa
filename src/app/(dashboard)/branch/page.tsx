import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { ApprovalQueue } from "@/components/operations/approval-queue";
import { RecordPaymentForm } from "@/components/operations/record-payment-form";
import { RecordDonationForm } from "@/components/operations/record-donation-form";
import { CreateStudentForm } from "@/components/operations/create-student-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function BranchOpsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", user!.id)
    .single();

  const [{ data: students }, { data: dues }, { data: payments }, { data: donations }] =
    await Promise.all([
      supabase
        .from("students")
        .select("id, full_name, admission_no, guardian_phone, status")
        .eq("status", "active")
        .order("full_name")
        .limit(200),
      supabase
        .from("fee_dues")
        .select("id, student_id, total_due, amount_paid, status, due_month, due_year")
        .neq("status", "paid")
        .order("due_year", { ascending: false })
        .limit(200),
      supabase
        .from("payments")
        .select("id, amount, status, method, student_id, created_at, accountant_remarks, principal_remarks")
        .in("status", ["pending_accountant", "pending_principal"])
        .order("created_at", { ascending: true }),
      supabase
        .from("donations")
        .select("id, amount, status, type, donor_name, created_at")
        .in("status", ["pending_accountant", "pending_principal"])
        .order("created_at", { ascending: true }),
    ]);

  const canEnter =
    ["data_entry"].includes(profile!.role) &&
    !!profile!.vendor_id &&
    !!profile!.branch_id;
  const canReview = [
    "accountant",
    "principal",
    "vendor_admin",
    "super_admin",
  ].includes(profile!.role);

  return (
    <AppShell
      profile={profile!}
      title="Branch operations"
      nav={[
        { href: "/branch", label: "Operations" },
        ...(profile!.role === "vendor_admin"
          ? [{ href: "/vendor", label: "Vendor" }]
          : []),
      ]}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {canEnter ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Add student</CardTitle>
                <CardDescription>
                  Student, health info, and fee plan in one submit.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CreateStudentForm
                  vendorId={profile!.vendor_id ?? ""}
                  branchId={profile!.branch_id ?? ""}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Record payment</CardTitle>
                <CardDescription>
                  Starts at pending accountant review.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RecordPaymentForm
                  students={students ?? []}
                  dues={dues ?? []}
                />
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Record donation</CardTitle>
              </CardHeader>
              <CardContent>
                <RecordDonationForm
                  vendorId={profile!.vendor_id ?? ""}
                  branchId={profile!.branch_id ?? ""}
                />
              </CardContent>
            </Card>
          </>
        ) : null}

        {canReview ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Approval queue</CardTitle>
              <CardDescription>
                Accountant → Principal → ledger post (atomic trigger).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ApprovalQueue
                role={profile!.role}
                payments={payments ?? []}
                donations={donations ?? []}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
