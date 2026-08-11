import { ApprovalQueue } from "@/components/operations/approval-queue";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OpsShell } from "@/components/layout/ops-shell";
import { requireOpsContext } from "@/lib/ops-page";

export default async function ApprovalsPage() {
  const { supabase, profile } = await requireOpsContext();

  let paymentsQ = supabase
    .from("payments")
    .select(
      "id, amount, status, method, student_id, created_at, accountant_remarks, principal_remarks",
    )
    .in("status", ["pending_accountant", "pending_principal"])
    .order("created_at", { ascending: true });
  let donationsQ = supabase
    .from("donations")
    .select("id, amount, status, type, donor_name, created_at")
    .in("status", ["pending_accountant", "pending_principal"])
    .order("created_at", { ascending: true });

  if (profile.vendor_id) {
    paymentsQ = paymentsQ.eq("vendor_id", profile.vendor_id);
    donationsQ = donationsQ.eq("vendor_id", profile.vendor_id);
  }
  if (profile.branch_id) {
    paymentsQ = paymentsQ.eq("branch_id", profile.branch_id);
    donationsQ = donationsQ.eq("branch_id", profile.branch_id);
  }

  const [{ data: payments }, { data: donations }] = await Promise.all([
    paymentsQ,
    donationsQ,
  ]);

  return (
    <OpsShell profile={profile} title="Approvals">
      <Card>
        <CardHeader>
          <CardTitle>Approval queue</CardTitle>
          <CardDescription>
            Admin reviews data-entry submissions and can approve in one step.
            Legacy two-stage (accountant → principal) still works if those roles
            are used.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ApprovalQueue
            role={profile.role}
            payments={(payments ?? []).map((p) => ({
              id: p.id,
              amount: Number(p.amount),
              status: p.status,
              method: p.method,
              student_id: p.student_id,
              created_at: p.created_at,
            }))}
            donations={(donations ?? []).map((d) => ({
              id: d.id,
              amount: Number(d.amount),
              status: d.status,
              type: d.type,
              donor_name: d.donor_name,
              created_at: d.created_at,
            }))}
          />
        </CardContent>
      </Card>
    </OpsShell>
  );
}
