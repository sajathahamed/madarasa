import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyRow, PanelTable } from "@/components/layout/panel-table";
import { VendorStudentsTable } from "@/components/students/vendor-students-table";
import { DashboardHero, StatCard } from "@/components/dashboard/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { CreateUserForm } from "@/components/admin/create-user-form";
import { CreateBranchForm } from "@/components/admin/create-branch-form";
import { ToggleUserStatusButton } from "@/components/admin/status-toggles";
import { ResetPasswordButton } from "@/components/admin/reset-password-button";
import { notificationStatus } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { brandingForVendorName } from "@/lib/vendor-branding";

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

  if (!profile?.vendor_id && profile?.role !== "super_admin") {
    redirect("/login");
  }

  const vendorId = profile!.vendor_id!;

  const { data: vendor } = await supabase
    .from("vendors")
    .select("*")
    .eq("id", vendorId)
    .maybeSingle();

  const [
    { count: students },
    { count: staffCount },
    { count: pendingPayments },
    { count: pendingDonations },
    { count: approvedPayments },
    { data: dues },
    { data: branches },
    { data: staff },
    { data: recentStudents },
    { data: payments },
    { data: donations },
    { data: accounts },
    { data: ledger },
    { data: auditLogs },
  ] = await Promise.all([
    supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("vendor_id", vendorId)
      .eq("status", "active"),
    supabase
      .from("app_users")
      .select("*", { count: "exact", head: true })
      .eq("vendor_id", vendorId),
    supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("vendor_id", vendorId)
      .in("status", ["pending_accountant", "pending_principal"]),
    supabase
      .from("donations")
      .select("*", { count: "exact", head: true })
      .eq("vendor_id", vendorId)
      .in("status", ["pending_accountant", "pending_principal"]),
    supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("vendor_id", vendorId)
      .eq("status", "approved"),
    supabase
      .from("fee_dues")
      .select("total_due, amount_paid")
      .eq("vendor_id", vendorId)
      .neq("status", "paid"),
    supabase
      .from("branches")
      .select("id, name, vendor_id, contact_phone, address")
      .eq("vendor_id", vendorId)
      .order("name"),
    supabase
      .from("app_users")
      .select(
        "id, full_name, role, status, whatsapp_number, phone, created_at, branch_id",
      )
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false }),
    supabase
      .from("students")
      .select(
        "id, admission_no, full_name, guardian_name, guardian_phone, status, branch_id, created_at",
      )
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("payments")
      .select("id, amount, status, method, created_at, student_id, branch_id")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("donations")
      .select("id, amount, status, donor_name, type, created_at, branch_id")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("accounts")
      .select("*")
      .eq("vendor_id", vendorId)
      .order("name"),
    supabase
      .from("ledger_entries")
      .select(
        "id, entry_type, amount, entry_date, source_table, account_id, branch_id",
      )
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("audit_logs")
      .select("id, action, table_name, created_at")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const outstanding = (dues ?? []).reduce(
    (sum, d) => sum + Number(d.total_due) - Number(d.amount_paid),
    0,
  );

  const branchMap = new Map((branches ?? []).map((b) => [b.id, b.name]));
  const studentMap = new Map(
    (recentStudents ?? []).map((s) => [s.id, s.full_name]),
  );
  const accountMap = new Map((accounts ?? []).map((a) => [a.id, a.name]));

  // Fill student names for payments that may not be in recentStudents slice
  const missingStudentIds = [
    ...new Set(
      (payments ?? [])
        .map((p) => p.student_id)
        .filter((id) => !studentMap.has(id)),
    ),
  ];
  if (missingStudentIds.length > 0) {
    const { data: extraStudents } = await supabase
      .from("students")
      .select("id, full_name")
      .in("id", missingStudentIds);
    for (const s of extraStudents ?? []) studentMap.set(s.id, s.full_name);
  }

  const emailById: Record<string, string> = {};
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    for (const u of data.users) {
      if (u.email) emailById[u.id] = u.email;
    }
  } catch (err) {
    console.error("[vendor listUsers]", err);
  }

  const branding = brandingForVendorName(vendor?.name);
  const vendorTitle =
    branding?.nameEn ?? vendor?.name ?? "Vendor dashboard";

  return (
    <AppShell
      profile={profile!}
      title={vendorTitle}
      subtitle="Your madrasa command centre"
      branding={branding}
      nav={[
        { href: "/vendor", label: "Overview" },
        { href: "/vendor#staff", label: "Staff" },
        { href: "/branch/students", label: "Students" },
        { href: "/vendor#finance", label: "Finance" },
        { href: "/branch", label: "Branch ops" },
        { href: "/branch/accountant", label: "Approvals" },
        { href: "/branch/reports", label: "Reports" },
      ]}
    >
      <DashboardHero
        eyebrow={vendor?.status === "active" ? "Active madrasa" : "Madrasa"}
        arabic={branding?.nameAr ?? "ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ"}
        title={vendorTitle}
        subtitle={`Full visibility for students, staff, fees, and ledger · ${process.env.NEXT_PUBLIC_CURRENCY ?? "LKR"}${notificationStatus().dialogConfigured ? " · Dialog SMS ready" : " · SMS ready when Dialog creds arrive"}`}
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Active students" value={students ?? 0} accent="emerald" />
        <StatCard label="Staff" value={staffCount ?? 0} accent="stone" />
        <StatCard
          label="Outstanding dues"
          value={formatMoney(outstanding)}
          accent="amber"
        />
        <StatCard
          label="Pending payments"
          value={pendingPayments ?? 0}
          accent="sky"
        />
        <StatCard
          label="Pending donations"
          value={pendingDonations ?? 0}
          accent="rose"
        />
        <StatCard
          label="Approved payments"
          value={approvedPayments ?? 0}
          accent="emerald"
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-3 text-sm">
        <Link
          href="/branch"
          className="rounded-full bg-[#0b3d2e] px-4 py-2 text-[#f7faf8]"
        >
          Open branch dashboard
        </Link>
        <Link
          href="/branch/accountant"
          className="rounded-full border border-[#0b3d2e]/25 px-4 py-2 text-[#0b3d2e]"
        >
          Approvals desk
        </Link>
        <a
          href="#create-staff"
          className="rounded-full border border-[#0b3d2e]/25 px-4 py-2 text-[#0b3d2e]"
        >
          Add staff
        </a>
      </div>

      <PanelTable
        id="staff"
        title="Staff directory (login credentials)"
        description="Username is the email. Passwords are hashed — use Reset password to get a new temporary password."
        headers={[
          "Name",
          "Username (email)",
          "Role",
          "Branch",
          "WhatsApp",
          "Status",
          "Joined",
          "",
        ]}
      >
        {(staff ?? []).length === 0 ? (
          <EmptyRow colSpan={8}>No staff yet. Add users below.</EmptyRow>
        ) : (
          (staff ?? []).map((s) => (
            <tr key={s.id} className="border-t border-[#0b3d2e]/8">
              <td className="px-3 py-2 font-medium">{s.full_name}</td>
              <td className="px-3 py-2 font-mono text-xs">
                {emailById[s.id] || "—"}
              </td>
              <td className="px-3 py-2">
                <StatusBadge value={s.role} />
              </td>
              <td className="px-3 py-2">
                {s.branch_id ? branchMap.get(s.branch_id) ?? "—" : "—"}
              </td>
              <td className="px-3 py-2">{s.whatsapp_number || "—"}</td>
              <td className="px-3 py-2">
                <StatusBadge value={s.status} />
              </td>
              <td className="px-3 py-2">{formatDate(s.created_at)}</td>
              <td className="px-3 py-2">
                <div className="flex flex-col gap-2">
                  {s.id !== user!.id ? (
                    <ToggleUserStatusButton userId={s.id} status={s.status} />
                  ) : null}
                  <ResetPasswordButton userId={s.id} />
                </div>
              </td>
            </tr>
          ))
        )}
      </PanelTable>

      <VendorStudentsTable
        students={recentStudents ?? []}
        branchMap={Object.fromEntries(branchMap)}
      />

      <div id="finance" className="grid gap-6 lg:grid-cols-2">
        <PanelTable
          title="Payments"
          headers={["Student", "Branch", "Amount", "Status", "Date"]}
        >
          {(payments ?? []).length === 0 ? (
            <EmptyRow colSpan={5}>No payments recorded.</EmptyRow>
          ) : (
            (payments ?? []).map((p) => (
              <tr key={p.id} className="border-t border-[#0b3d2e]/8">
                <td className="px-3 py-2">
                  {studentMap.get(p.student_id) ?? "—"}
                </td>
                <td className="px-3 py-2">
                  {p.branch_id ? branchMap.get(p.branch_id) ?? "—" : "—"}
                </td>
                <td className="px-3 py-2">{formatMoney(p.amount)}</td>
                <td className="px-3 py-2">
                  <StatusBadge value={p.status} />
                </td>
                <td className="px-3 py-2">{formatDate(p.created_at)}</td>
              </tr>
            ))
          )}
        </PanelTable>

        <PanelTable
          title="Donations"
          headers={["Donor", "Branch", "Amount", "Status", "Date"]}
        >
          {(donations ?? []).length === 0 ? (
            <EmptyRow colSpan={5}>No donations recorded.</EmptyRow>
          ) : (
            (donations ?? []).map((d) => (
              <tr key={d.id} className="border-t border-[#0b3d2e]/8">
                <td className="px-3 py-2">{d.donor_name}</td>
                <td className="px-3 py-2">
                  {d.branch_id ? branchMap.get(d.branch_id) ?? "—" : "—"}
                </td>
                <td className="px-3 py-2">{formatMoney(d.amount)}</td>
                <td className="px-3 py-2">
                  <StatusBadge value={d.status} />
                </td>
                <td className="px-3 py-2">{formatDate(d.created_at)}</td>
              </tr>
            ))
          )}
        </PanelTable>
      </div>

      <PanelTable
        title="Account balances"
        headers={["Account", "Type", "Opening", "Current"]}
      >
        {(accounts ?? []).length === 0 ? (
          <EmptyRow colSpan={4}>No ledger accounts.</EmptyRow>
        ) : (
          (accounts ?? []).map((a) => (
            <tr key={a.id} className="border-t border-[#0b3d2e]/8">
              <td className="px-3 py-2">{a.name}</td>
              <td className="px-3 py-2 capitalize">{a.type}</td>
              <td className="px-3 py-2">{formatMoney(a.opening_balance)}</td>
              <td className="px-3 py-2 font-medium">
                {formatMoney(a.current_balance)}
              </td>
            </tr>
          ))
        )}
      </PanelTable>

      <PanelTable
        title="Ledger entries"
        headers={["Date", "Account", "Branch", "Type", "Amount", "Source"]}
      >
        {(ledger ?? []).length === 0 ? (
          <EmptyRow colSpan={6}>
            No posted ledger entries yet (appear after admin approval).
          </EmptyRow>
        ) : (
          (ledger ?? []).map((e) => (
            <tr key={e.id} className="border-t border-[#0b3d2e]/8">
              <td className="px-3 py-2">{formatDate(e.entry_date)}</td>
              <td className="px-3 py-2">
                {accountMap.get(e.account_id) ?? "—"}
              </td>
              <td className="px-3 py-2">
                {e.branch_id ? branchMap.get(e.branch_id) ?? "—" : "—"}
              </td>
              <td className="px-3 py-2 capitalize">{e.entry_type}</td>
              <td className="px-3 py-2">{formatMoney(e.amount)}</td>
              <td className="px-3 py-2">{e.source_table}</td>
            </tr>
          ))
        )}
      </PanelTable>

      <PanelTable title="Activity log" headers={["When", "Action", "Table"]}>
        {(auditLogs ?? []).length === 0 ? (
          <EmptyRow colSpan={3}>No activity yet.</EmptyRow>
        ) : (
          (auditLogs ?? []).map((a) => (
            <tr key={a.id} className="border-t border-[#0b3d2e]/8">
              <td className="px-3 py-2">{formatDate(a.created_at)}</td>
              <td className="px-3 py-2">{a.action}</td>
              <td className="px-3 py-2">{a.table_name}</td>
            </tr>
          ))
        )}
      </PanelTable>

      <div id="create-staff" className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add branch</CardTitle>
            <CardDescription>
              Create another branch under your madrasa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateBranchForm
              vendors={
                vendor
                  ? [{ id: vendor.id, name: vendor.name }]
                  : [{ id: vendorId, name: "This madrasa" }]
              }
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Add staff user</CardTitle>
            <CardDescription>
              Two levels only: Admin (full oversight) or Data entry (ops entry).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateUserForm
              vendors={
                vendor
                  ? [{ id: vendor.id, name: vendor.name }]
                  : [{ id: vendorId, name: "This madrasa" }]
              }
              branches={(branches ?? []).map((b) => ({
                id: b.id,
                name: b.name,
                vendor_id: b.vendor_id,
              }))}
              allowSuperAdmin={false}
              lockVendorId={vendorId}
            />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
