import { RecordDonationForm } from "@/components/operations/record-donation-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canEnterData } from "@/lib/auth/session";
import { formatDate, formatMoney } from "@/lib/format";
import { OpsShell } from "@/components/layout/ops-shell";
import { requireOpsContext } from "@/lib/ops-page";
import { StatusBadge } from "@/components/ui/status-badge";

export default async function DonationsPage() {
  const { supabase, profile } = await requireOpsContext();

  let branchesQ = supabase.from("branches").select("id, name, vendor_id").order("name");
  let donationsQ = supabase
    .from("donations")
    .select("id, amount, status, type, donor_name, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (profile.vendor_id) {
    branchesQ = branchesQ.eq("vendor_id", profile.vendor_id);
    donationsQ = donationsQ.eq("vendor_id", profile.vendor_id);
  }
  if (profile.branch_id) {
    donationsQ = donationsQ.eq("branch_id", profile.branch_id);
  }

  const [{ data: branches }, { data: donations }] = await Promise.all([
    branchesQ,
    donationsQ,
  ]);

  const vendorId = profile.vendor_id || branches?.[0]?.vendor_id || "";
  const branchId = profile.branch_id || branches?.[0]?.id || "";

  return (
    <OpsShell profile={profile} title="Donations">
      <div className="grid gap-6 lg:grid-cols-2">
        {canEnterData(profile.role) ? (
          <Card>
            <CardHeader>
              <CardTitle>Record donation</CardTitle>
              <CardDescription>Goes through dual approval.</CardDescription>
            </CardHeader>
            <CardContent>
              <RecordDonationForm vendorId={vendorId} branchId={branchId} />
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Recent donations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {(donations ?? []).map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between rounded-lg border border-[#0b3d2e]/10 px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{d.donor_name}</p>
                    <p className="text-xs text-[#5a6f65]">
                      {formatDate(d.created_at)} · {d.type}
                    </p>
                  </div>
                  <div className="text-right">
                    <p>{formatMoney(Number(d.amount))}</p>
                    <StatusBadge value={d.status} />
                  </div>
                </li>
              ))}
              {(donations ?? []).length === 0 ? (
                <li className="text-[#5a6f65]">No donations yet.</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      </div>
    </OpsShell>
  );
}
