import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateVendorForm } from "@/components/admin/create-vendor-form";
import { CreateBranchForm } from "@/components/admin/create-branch-form";
import { CreateUserForm } from "@/components/admin/create-user-form";

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

  const [{ count: vendorCount }, { count: branchCount }, { data: vendors }] =
    await Promise.all([
      supabase.from("vendors").select("*", { count: "exact", head: true }),
      supabase.from("branches").select("*", { count: "exact", head: true }),
      supabase
        .from("vendors")
        .select("id, name, status, whatsapp_number, created_at")
        .order("created_at", { ascending: false }),
    ]);

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name, vendor_id")
    .order("name");

  return (
    <AppShell
      profile={profile!}
      title="Platform overview"
      nav={[
        { href: "/super-admin", label: "Dashboard" },
        { href: "/super-admin#vendors", label: "Vendors" },
        { href: "/super-admin#users", label: "Users" },
      ]}
    >
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
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
            <CardDescription>Currency</CardDescription>
            <CardTitle className="text-3xl">
              {process.env.NEXT_PUBLIC_CURRENCY ?? "LKR"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2" id="vendors">
        <Card>
          <CardHeader>
            <CardTitle>Create vendor</CardTitle>
            <CardDescription>
              Default ledger accounts are created automatically.
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

        <Card className="lg:col-span-2" id="users">
          <CardHeader>
            <CardTitle>Create user</CardTitle>
            <CardDescription>
              Creates Auth user + profile, then queues WhatsApp credentials.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateUserForm vendors={vendors ?? []} branches={branches ?? []} />
          </CardContent>
        </Card>
      </div>

      <section className="mt-8">
        <h2
          className="mb-3 text-xl text-[#0b3d2e]"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          Vendors
        </h2>
        <div className="overflow-x-auto rounded-lg border border-[#0b3d2e]/10 bg-white/70">
          <table className="w-full text-sm">
            <thead className="bg-[#0b3d2e]/5 text-left">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">WhatsApp</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {(vendors ?? []).length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-[#5a6f65]" colSpan={3}>
                    No vendors yet. Create the first madrasa above.
                  </td>
                </tr>
              ) : (
                (vendors ?? []).map((v) => (
                  <tr key={v.id} className="border-t border-[#0b3d2e]/8">
                    <td className="px-3 py-2">{v.name}</td>
                    <td className="px-3 py-2">{v.whatsapp_number}</td>
                    <td className="px-3 py-2 capitalize">{v.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
