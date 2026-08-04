import Link from "next/link";

import { OpsShell } from "@/components/layout/ops-shell";
import { requireOpsContext } from "@/lib/ops-page";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function BranchOverviewPage() {
  const { supabase, profile } = await requireOpsContext();

  let studentsQ = supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  let duesQ = supabase
    .from("fee_dues")
    .select("id", { count: "exact", head: true })
    .neq("status", "paid");
  let pendingQ = supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending_accountant", "pending_principal"]);

  if (profile.vendor_id) {
    studentsQ = studentsQ.eq("vendor_id", profile.vendor_id);
    duesQ = duesQ.eq("vendor_id", profile.vendor_id);
    pendingQ = pendingQ.eq("vendor_id", profile.vendor_id);
  }
  if (profile.branch_id) {
    studentsQ = studentsQ.eq("branch_id", profile.branch_id);
    duesQ = duesQ.eq("branch_id", profile.branch_id);
    pendingQ = pendingQ.eq("branch_id", profile.branch_id);
  }

  const [students, dues, pending] = await Promise.all([
    studentsQ,
    duesQ,
    pendingQ,
  ]);

  const links = [
    {
      href: "/branch/accountant",
      title: "Accountant desk",
      desc: "Approvals, carry-forward dues, reminders",
    },
    { href: "/branch/students", title: "Students", desc: "Directory, profiles, fee plans" },
    { href: "/branch/fees", title: "Fees", desc: "Record payments, overdue, reminders" },
    { href: "/branch/approvals", title: "Approvals", desc: "Accountant → Principal queue" },
    { href: "/branch/donations", title: "Donations", desc: "Record and track donations" },
    { href: "/branch/classes", title: "Classes", desc: "Sections and enrollments" },
    { href: "/branch/attendance", title: "Attendance", desc: "Daily register" },
    { href: "/branch/progress", title: "Progress", desc: "Qaida, Nazirah, Hifz logs" },
    { href: "/branch/reports", title: "Reports", desc: "Collection, attendance, at-risk" },
  ];

  return (
    <OpsShell profile={profile} title="Branch operations">
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active students</CardDescription>
            <CardTitle className="text-3xl">{students.count ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Open dues</CardDescription>
            <CardTitle className="text-3xl">{dues.count ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending payments</CardDescription>
            <CardTitle className="text-3xl">{pending.count ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <Link key={l.href} href={l.href}>
            <Card className="h-full transition hover:border-[#0b3d2e]/30">
              <CardHeader>
                <CardTitle className="text-lg">{l.title}</CardTitle>
                <CardDescription>{l.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm text-[#0b3d2e] underline">Open →</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </OpsShell>
  );
}
