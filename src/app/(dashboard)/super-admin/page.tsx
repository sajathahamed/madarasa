import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyRow, PanelTable } from "@/components/layout/panel-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { CreateVendorForm } from "@/components/admin/create-vendor-form";
import { CreateBranchForm } from "@/components/admin/create-branch-form";
import { CreateUserForm } from "@/components/admin/create-user-form";
import {
  ToggleUserStatusButton,
  ToggleVendorStatusButton,
} from "@/components/admin/status-toggles";

function mapById<T extends { id: string }>(rows: T[] | null | undefined) {
  return new Map((rows ?? []).map((r) => [r.id, r]));
}

export default async function SuperAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", user!.id)
    .single();

  const [
    { count: vendorCount },
    { count: branchCount },
    { count: userCount },
    { count: studentCount },
    { count: pendingApprovals },
    { data: vendors },
    { data: branches },
    { data: users },
    { data: students },
    { data: recentPayments },
    { data: recentDonations },
    { data: auditLogs },
  ] = await Promise.all([
    supabase.from("vendors").select("*", { count: "exact", head: true }),
    supabase.from("branches").select("*", { count: "exact", head: true }),
    supabase.from("app_users").select("*", { count: "exact", head: true }),
    supabase.from("students").select("*", { count: "exact", head: true }),
    supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending_accountant", "pending_principal"]),
    supabase
      .from("vendors")
      .select("id, name, status, whatsapp_number, contact_phone, address, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("branches")
      .select("id, name, vendor_id, contact_phone, address, created_at")
      .order("name"),
    supabase
      .from("app_users")
      .select(
        "id, full_name, role, status, phone, whatsapp_number, created_at, vendor_id, branch_id",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("students").select("id, full_name").limit(500),
    supabase
      .from("payments")
      .select("id, amount, status, method, created_at, vendor_id, student_id")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("donations")
      .select("id, amount, status, donor_name, type, created_at, vendor_id")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("audit_logs")
      .select("id, action, table_name, created_at, vendor_id")
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const vendorMap = mapById(vendors);
  const branchMap = mapById(branches);
  const studentMap = mapById(students);

  return (
    <AppShell
      profile={profile!}
      title="Platform control"
      nav={[
        { href: "/super-admin", label: "Dashboard" },
        { href: "/super-admin#users-list", label: "Users" },
        { href: "/super-admin#vendors-list", label: "Vendors" },
        { href: "/super-admin#activity", label: "Activity" },
        { href: "/super-admin#create", label: "Create" },
      ]}
    >
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Vendors</CardDescription>
            <CardTitle className="text-3xl">{vendorCount ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Branches</CardDescription>
            <CardTitle className="text-3xl">{branchCount ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Users</CardDescription>
            <CardTitle className="text-3xl">{userCount ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Students</CardDescription>
            <CardTitle className="text-3xl">{studentCount ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending payments</CardDescription>
            <CardTitle className="text-3xl">{pendingApprovals ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <PanelTable
        id="users-list"
        title="All users"
        description="Every platform and madrasa staff account — including ones you just created."
        headers={[
          "Name",
          "Role",
          "Vendor",
          "Branch",
          "WhatsApp",
          "Status",
          "Created",
          "",
        ]}
      >
        {(users ?? []).length === 0 ? (
          <EmptyRow colSpan={8}>No users yet. Create one below.</EmptyRow>
        ) : (
          (users ?? []).map((u) => (
            <tr key={u.id} className="border-t border-[#0b3d2e]/8">
              <td className="px-3 py-2">
                <div className="font-medium">{u.full_name}</div>
                <div className="text-xs text-[#5a6f65]">{u.phone || "—"}</div>
              </td>
              <td className="px-3 py-2">
                <StatusBadge value={u.role} />
              </td>
              <td className="px-3 py-2">
                {u.vendor_id ? vendorMap.get(u.vendor_id)?.name ?? "—" : "—"}
              </td>
              <td className="px-3 py-2">
                {u.branch_id ? branchMap.get(u.branch_id)?.name ?? "—" : "—"}
              </td>
              <td className="px-3 py-2">{u.whatsapp_number || "—"}</td>
              <td className="px-3 py-2">
                <StatusBadge value={u.status} />
              </td>
              <td className="px-3 py-2">{formatDate(u.created_at)}</td>
              <td className="px-3 py-2">
                {u.id !== user!.id ? (
                  <ToggleUserStatusButton userId={u.id} status={u.status} />
                ) : null}
              </td>
            </tr>
          ))
        )}
      </PanelTable>

      <PanelTable
        id="vendors-list"
        title="Vendors (madrasas)"
        headers={[
          "Name",
          "WhatsApp",
          "Contact",
          "Address",
          "Status",
          "Created",
          "",
        ]}
      >
        {(vendors ?? []).length === 0 ? (
          <EmptyRow colSpan={7}>No vendors yet.</EmptyRow>
        ) : (
          (vendors ?? []).map((v) => (
            <tr key={v.id} className="border-t border-[#0b3d2e]/8">
              <td className="px-3 py-2 font-medium">
                <Link
                  href={`/super-admin/vendors/${v.id}`}
                  className="text-[#0b3d2e] underline-offset-2 hover:underline"
                >
                  {v.name}
                </Link>
              </td>
              <td className="px-3 py-2">{v.whatsapp_number}</td>
              <td className="px-3 py-2">{v.contact_phone || "—"}</td>
              <td className="px-3 py-2 max-w-[180px] truncate">
                {v.address || "—"}
              </td>
              <td className="px-3 py-2">
                <StatusBadge value={v.status} />
              </td>
              <td className="px-3 py-2">{formatDate(v.created_at)}</td>
              <td className="px-3 py-2">
                <ToggleVendorStatusButton vendorId={v.id} status={v.status} />
              </td>
            </tr>
          ))
        )}
      </PanelTable>

      <PanelTable
        title="Branches"
        headers={["Branch", "Vendor", "Phone", "Address", "Created"]}
      >
        {(branches ?? []).length === 0 ? (
          <EmptyRow colSpan={5}>No branches yet.</EmptyRow>
        ) : (
          (branches ?? []).map((b) => (
            <tr key={b.id} className="border-t border-[#0b3d2e]/8">
              <td className="px-3 py-2 font-medium">{b.name}</td>
              <td className="px-3 py-2">
                {vendorMap.get(b.vendor_id)?.name ?? "—"}
              </td>
              <td className="px-3 py-2">{b.contact_phone || "—"}</td>
              <td className="px-3 py-2">{b.address || "—"}</td>
              <td className="px-3 py-2">{formatDate(b.created_at)}</td>
            </tr>
          ))
        )}
      </PanelTable>

      <div id="activity" className="mt-8 grid gap-6 lg:grid-cols-2">
        <PanelTable
          title="Recent payments"
          headers={["Vendor", "Student", "Amount", "Status", "Date"]}
        >
          {(recentPayments ?? []).length === 0 ? (
            <EmptyRow colSpan={5}>No payments yet.</EmptyRow>
          ) : (
            (recentPayments ?? []).map((p) => (
              <tr key={p.id} className="border-t border-[#0b3d2e]/8">
                <td className="px-3 py-2">
                  {vendorMap.get(p.vendor_id)?.name ?? "—"}
                </td>
                <td className="px-3 py-2">
                  {studentMap.get(p.student_id)?.full_name ?? "—"}
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
          title="Recent donations"
          headers={["Vendor", "Donor", "Amount", "Status", "Date"]}
        >
          {(recentDonations ?? []).length === 0 ? (
            <EmptyRow colSpan={5}>No donations yet.</EmptyRow>
          ) : (
            (recentDonations ?? []).map((d) => (
              <tr key={d.id} className="border-t border-[#0b3d2e]/8">
                <td className="px-3 py-2">
                  {vendorMap.get(d.vendor_id)?.name ?? "—"}
                </td>
                <td className="px-3 py-2">{d.donor_name}</td>
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
        title="Audit trail"
        description="Approvals and financial postings across the platform."
        headers={["When", "Vendor", "Action", "Table"]}
      >
        {(auditLogs ?? []).length === 0 ? (
          <EmptyRow colSpan={4}>No audit events yet.</EmptyRow>
        ) : (
          (auditLogs ?? []).map((a) => (
            <tr key={a.id} className="border-t border-[#0b3d2e]/8">
              <td className="px-3 py-2">{formatDate(a.created_at)}</td>
              <td className="px-3 py-2">
                {a.vendor_id ? vendorMap.get(a.vendor_id)?.name ?? "—" : "—"}
              </td>
              <td className="px-3 py-2">{a.action}</td>
              <td className="px-3 py-2">{a.table_name}</td>
            </tr>
          ))
        )}
      </PanelTable>

      <div className="mt-10 grid gap-6 lg:grid-cols-2" id="create">
        <Card>
          <CardHeader>
            <CardTitle>Create vendor</CardTitle>
            <CardDescription>
              Creates default ledger accounts automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateVendorForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create branch</CardTitle>
            <CardDescription>Attach a branch to a vendor.</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateBranchForm vendors={vendors ?? []} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Create user</CardTitle>
            <CardDescription>
              Creates Auth login + profile. Temp password is shown after create.
              New users appear in the Users table above.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateUserForm
              vendors={(vendors ?? []).map((v) => ({ id: v.id, name: v.name }))}
              branches={(branches ?? []).map((b) => ({
                id: b.id,
                name: b.name,
                vendor_id: b.vendor_id,
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
