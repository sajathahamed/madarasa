import Link from "next/link";

import { OpsShell } from "@/components/layout/ops-shell";
import { requireOpsContext } from "@/lib/ops-page";
import {
  DashboardHero,
  ModuleLink,
  StatCard,
} from "@/components/dashboard/ui";
import { roleLabel } from "@/lib/auth/roles";
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
    .select(
      "total_due_sum:total_due.sum(), amount_paid_sum:amount_paid.sum(), carried_forward_sum:carried_forward.sum(), open_count:id.count()",
    )
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
    duesQ.maybeSingle(),
    pendingQ,
    classesQ,
  ]);

  const duesSums = duesRes.data as {
    total_due_sum?: number | string | null;
    amount_paid_sum?: number | string | null;
    carried_forward_sum?: number | string | null;
    open_count?: number | string | null;
  } | null;
  const outstanding =
    Number(duesSums?.total_due_sum ?? 0) - Number(duesSums?.amount_paid_sum ?? 0);
  const carried = Number(duesSums?.carried_forward_sum ?? 0);
  const openDuesCount = Number(duesSums?.open_count ?? 0);

  const role = profile.role;
  const allLinks = [
    {
      href: "/branch/accountant",
      title: "Approvals desk",
      description: "Review & approve payments, dues, reminders",
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
      title: role === "data_entry" ? "My submissions" : "Approvals",
      description:
        role === "data_entry"
          ? "Track payments you submitted for admin review"
          : "Approve payments submitted by data entry",
      roles: [
        "accountant",
        "principal",
        "vendor_admin",
        "super_admin",
        "data_entry",
      ],
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
      href: "/branch/sms",
      title: "Send SMS",
      description: "Compose custom parent SMS",
      roles: [
        "super_admin",
        "vendor_admin",
        "data_entry",
        "accountant",
        "principal",
      ],
    },
    {
      href: "/branch/reports",
      title: "Reports",
      description: "Collection, attendance, at-risk",
      roles: [
        "super_admin",
        "vendor_admin",
        "data_entry",
        "accountant",
        "principal",
      ],
    },
  ].filter((l) => l.roles.includes(role));

  const greetings: Record<string, { title: string; subtitle: string }> = {
    data_entry: {
      title: "Data entry workspace",
      subtitle: "Admit students, record fees, attendance, and class work.",
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
      title: "Admin workspace",
      subtitle:
        "Full visibility — approve data entry work, reports, and admin tools.",
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
      subtitle={`${roleLabel(profile.role)} workspace`}
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
          value={openDuesCount}
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

      {role === "vendor_admin" ? (
        <p className="mt-6 text-sm text-[#5a6f65]">
          Review data entry submissions at the{" "}
          <Link href="/branch/accountant" className="text-[#0b3d2e] underline">
            Approvals desk
          </Link>
          .
        </p>
      ) : null}
      {role === "accountant" ? (
        <p className="mt-6 text-sm text-[#5a6f65]">
          Prefer the focused desk?{" "}
          <Link href="/branch/accountant" className="text-[#0b3d2e] underline">
            Open Approvals desk
          </Link>
        </p>
      ) : null}
    </OpsShell>
  );
}
