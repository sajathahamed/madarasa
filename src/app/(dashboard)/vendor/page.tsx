import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function VendorDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", user!.id)
    .single();

  const vendorId = profile!.vendor_id;

  const [
    { count: students },
    { count: pendingPayments },
    { count: pendingDonations },
    { data: dues },
  ] = await Promise.all([
    supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending_accountant", "pending_principal"]),
    supabase
      .from("donations")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending_accountant", "pending_principal"]),
    supabase
      .from("fee_dues")
      .select("total_due, amount_paid")
      .neq("status", "paid"),
  ]);

  const outstanding = (dues ?? []).reduce(
    (sum, d) => sum + Number(d.total_due) - Number(d.amount_paid),
    0,
  );

  return (
    <AppShell
      profile={profile!}
      title="Vendor dashboard"
      nav={[
        { href: "/vendor", label: "Overview" },
        { href: "/branch", label: "Operations" },
      ]}
    >
      <p className="mb-6 text-sm text-[#5a6f65]">
        Vendor ID: {vendorId ?? "n/a"} · Currency{" "}
        {process.env.NEXT_PUBLIC_CURRENCY ?? "LKR"}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active students</CardDescription>
            <CardTitle className="text-3xl">{students ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Outstanding dues</CardDescription>
            <CardTitle className="text-3xl">
              {outstanding.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending payments</CardDescription>
            <CardTitle className="text-3xl">{pendingPayments ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending donations</CardDescription>
            <CardTitle className="text-3xl">{pendingDonations ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>
    </AppShell>
  );
}
