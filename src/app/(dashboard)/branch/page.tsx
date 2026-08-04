import Link from "next/link";

import { OpsShell } from "@/components/layout/ops-shell";
import { requireOpsContext } from "@/lib/ops-page";
import {
  DashboardHero,
  ModuleLink,
  StatCard,
} from "@/components/dashboard/ui";
import { formatMoney } from "@/lib/format";
import { notificationStatus } from "@/lib/notify";

export default async function BranchOverviewPage() {
  const { supabase, profile } = await requireOpsContext();

  let studentsQ = supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  let duesQ = supabase
    .from("fee_dues")
    .select("total_due, amount_paid, carried_forward")
    .neq("status", "paid");
  let pendingQ = supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending_accountant", "pending_principal"]);
  let classesQ = supabase
    .from("classes")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  if (profile.vendor_id) {
    studentsQ = studentsQ.eq("vendor_id", profile.vendor_id);
    duesQ = duesQ.eq("vendor_id", profile.vendor_id);
    pendingQ = pendingQ.eq("vendor_id", profile.vendor_id);
    classesQ = classesQ.eq("vendor_id", profile.vendor_id);
  }
  if (profile.branch_id) {
    studentsQ = studentsQ.eq("branch_id", profile.branch_id);
    duesQ = duesQ.eq("branch_id", profile.branch_id);
    pendingQ = pendingQ.eq("branch_id", profile.branch_id);
    classesQ = classesQ.eq("branch_id", profile.branch_id);
  }

  const [students, duesRes, pending, classes] = await Promise.all([
    studentsQ,
    duesQ,
    pendingQ,
    classesQ,
  ]);

  const outstanding = (duesRes.data ?? []).reduce(
    (s, d) => s + (Number(d.total_due) - Number(d.amount_paid)),
    0,
  );
  const carried = (duesRes.data ?? []).reduce(
    (s, d) => s + Number(d.carried_forward || 0),
    0,
  );

  const role = profile.role;
  const allLinks = [
    {
      href: "/branch/accountant",
      title: "Accountant desk",
      description: "Approvals, carry-forward dues, reminders",
      roles: ["accountant", "principal", "vendor_admin", "super_admin"],
    },
    {
      href: "/branch/students",
      title: "Students",
      description: "Directory, profiles, fee plans",
      roles: ["super_admin", "vendor_admin", "data_entry", "accountant", "principal"],
    },
    {
      href: "/branch/fees",
      title: "Fees",
      description: "Record payments and overdue follow-up",
      roles: ["super_admin", "vendor_admin", "data_entry", "accountant", "principal"],
    },
    {
      href: "/branch/approvals",
      title: "Approvals",
      description: "Accountant → Principal queue",
      roles: ["accountant", "principal", "vendor_admin", "super_admin"],
    },
    {
      href: "/branch/donations",
      title: "Donations",
      description: "Record and track donations",
      roles: ["super_admin", "vendor_admin", "data_entry", "accountant", "principal"],
    },
    {
      href: "/branch/classes",
      title: "Classes",
      description: "Sections and enrollments",
      roles: ["super_admin", "vendor_admin", "data_entry", "principal"],
    },
    {
      href: "/branch/attendance",
      title: "Attendance",
      description: "Daily register + parent alerts",
      roles: ["super_admin", "vendor_admin", "data_entry", "principal", "accountant"],
    },
    {
      href: "/branch/progress",
      title: "Progress",
      description: "Qaida, Nazirah, Hifz logs",
      roles: ["super_admin", "vendor_admin", "data_entry", "principal"],
    },
    {
      href: "/branch/reports",
      title: "Reports",
      description: "Collection, attendance, at-risk",
      roles: ["super_admin", "vendor_admin", "accountant", "principal"],
    },
  ].filter((l) => l.roles.includes(role));

  const greetings: Record<string, { title: string; subtitle: string }> = {
    data_entry: {
      title: "Today’s school office",
      subtitle: "Admit students, record fees, and keep class rolls ready.",
    },
    accountant: {
      title: "Finance control room",
      subtitle: "Review payments, watch carry-forward, and clear the queue.",
    },
    principal: {
      title: "Branch leadership view",
      subtitle: "Approve money, monitor attendance, and follow student progress.",
    },
    vendor_admin: {
      title: "Branch operations",
      subtitle: "Run the full madrasa stack from one calm workspace.",
    },
    super_admin: {
      title: "Branch operations",
      subtitle: "Operational tools available across tenants.",
    },
  };

  const g = greetings[role] || greetings.vendor_admin;
  const notify = notificationStatus();

  return (
    <OpsShell
      profile={profile}
      title="Dashboard"
      subtitle={`${(profile.role || "").replaceAll("_", " ")} workspace`}
    >
      <DashboardHero
        eyebrow="Madarasa · مدرسة"
        arabic="رَبِّ زِدْنِي عِلْمًا"
        title={g.title}
        subtitle={g.subtitle}
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active students"
          value={students.count ?? 0}
          accent="emerald"
        />
        <StatCard
          label="Open dues"
          value={duesRes.data?.length ?? 0}
          hint={formatMoney(outstanding)}
          accent="amber"
        />
        <StatCard
          label="Carried forward"
          value={formatMoney(carried)}
          accent="rose"
        />
        <StatCard
          label="Pending payments"
          value={pending.count ?? 0}
          hint={`${classes.count ?? 0} active classes`}
          accent="sky"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2
          className="text-xl text-[#0b3d2e]"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          Quick modules
        </h2>
        <p className="text-xs text-[#5a6f65]">
          Notify via {notify.channels.join(" + ") || "whatsapp"}
          {notify.dialogConfigured ? " · Dialog SMS ready" : " · Dialog SMS awaiting creds"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {allLinks.map((l) => (
          <ModuleLink
            key={l.href}
            href={l.href}
            title={l.title}
            description={l.description}
          />
        ))}
      </div>

      {role === "accountant" ? (
        <p className="mt-6 text-sm text-[#5a6f65]">
          Prefer the focused desk?{" "}
          <Link href="/branch/accountant" className="text-[#0b3d2e] underline">
            Open Accountant desk
          </Link>
        </p>
      ) : null}
    </OpsShell>
  );
}
