import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyRow, PanelTable } from "@/components/layout/panel-table";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ToggleVendorStatusButton } from "@/components/admin/status-toggles";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SuperAdminVendorDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", user!.id)
    .single();

  const { data: vendor } = await supabase
    .from("vendors")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!vendor) notFound();

  const [
    { data: branches },
    { data: staff },
    { count: students },
    { data: accounts },
    { data: payments },
    { data: donations },
    { data: studentRows },
  ] = await Promise.all([
    supabase.from("branches").select("*").eq("vendor_id", id).order("name"),
    supabase
      .from("app_users")
      .select("id, full_name, role, status, whatsapp_number, branch_id")
      .eq("vendor_id", id)
      .order("full_name"),
    supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("vendor_id", id),
    supabase.from("accounts").select("*").eq("vendor_id", id).order("name"),
    supabase
      .from("payments")
      .select("id, amount, status, method, created_at, student_id")
      .eq("vendor_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("donations")
      .select("id, amount, status, donor_name, created_at")
      .eq("vendor_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("students").select("id, full_name").eq("vendor_id", id),
  ]);

  const branchMap = new Map((branches ?? []).map((b) => [b.id, b.name]));
  const studentMap = new Map((studentRows ?? []).map((s) => [s.id, s.full_name]));

  return (
    <AppShell
      profile={profile!}
      title={vendor.name}
      nav={[
        { href: "/super-admin", label: "Dashboard" },
        { href: `/super-admin/vendors/${id}`, label: "Vendor" },
      ]}
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusBadge value={vendor.status} />
        <ToggleVendorStatusButton vendorId={vendor.id} status={vendor.status} />
        <Link href="/super-admin" className="text-sm text-[#0b3d2e] underline">
          Back to platform
        </Link>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Branches</CardDescription>
            <CardTitle className="text-3xl">{branches?.length ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Staff</CardDescription>
            <CardTitle className="text-3xl">{staff?.length ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Students</CardDescription>
            <CardTitle className="text-3xl">{students ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>WhatsApp</CardDescription>
            <CardTitle className="text-lg">{vendor.whatsapp_number}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <PanelTable title="Branches" headers={["Name", "Phone", "Address"]}>
        {(branches ?? []).length === 0 ? (
          <EmptyRow colSpan={3}>No branches.</EmptyRow>
        ) : (
          (branches ?? []).map((b) => (
            <tr key={b.id} className="border-t border-[#0b3d2e]/8">
              <td className="px-3 py-2">{b.name}</td>
              <td className="px-3 py-2">{b.contact_phone || "—"}</td>
              <td className="px-3 py-2">{b.address || "—"}</td>
            </tr>
          ))
        )}
      </PanelTable>

      <PanelTable
        title="Staff"
        headers={["Name", "Role", "Branch", "WhatsApp", "Status"]}
      >
        {(staff ?? []).length === 0 ? (
          <EmptyRow colSpan={5}>No staff linked to this vendor.</EmptyRow>
        ) : (
          (staff ?? []).map((s) => (
            <tr key={s.id} className="border-t border-[#0b3d2e]/8">
              <td className="px-3 py-2">{s.full_name}</td>
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
            </tr>
          ))
        )}
      </PanelTable>

      <PanelTable
        title="Ledger accounts"
        headers={["Account", "Type", "Opening", "Current"]}
      >
        {(accounts ?? []).length === 0 ? (
          <EmptyRow colSpan={4}>No accounts.</EmptyRow>
        ) : (
          (accounts ?? []).map((a) => (
            <tr key={a.id} className="border-t border-[#0b3d2e]/8">
              <td className="px-3 py-2">{a.name}</td>
              <td className="px-3 py-2 capitalize">{a.type}</td>
              <td className="px-3 py-2">{formatMoney(a.opening_balance)}</td>
              <td className="px-3 py-2">{formatMoney(a.current_balance)}</td>
            </tr>
          ))
        )}
      </PanelTable>

      <div className="grid gap-6 lg:grid-cols-2">
        <PanelTable
          title="Recent payments"
          headers={["Student", "Amount", "Status", "Date"]}
        >
          {(payments ?? []).length === 0 ? (
            <EmptyRow colSpan={4}>No payments.</EmptyRow>
          ) : (
            (payments ?? []).map((p) => (
              <tr key={p.id} className="border-t border-[#0b3d2e]/8">
                <td className="px-3 py-2">
                  {studentMap.get(p.student_id) ?? "—"}
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
          headers={["Donor", "Amount", "Status", "Date"]}
        >
          {(donations ?? []).length === 0 ? (
            <EmptyRow colSpan={4}>No donations.</EmptyRow>
          ) : (
            (donations ?? []).map((d) => (
              <tr key={d.id} className="border-t border-[#0b3d2e]/8">
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
    </AppShell>
  );
}
