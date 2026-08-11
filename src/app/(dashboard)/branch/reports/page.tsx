import { OpsShell } from "@/components/layout/ops-shell";
import { AtRiskStudentsList } from "@/components/students/at-risk-students-list";
import { PrincipalReportActions } from "@/components/reports/principal-report-actions";
import {
  PrincipalReportDocument,
  buildPrincipalReportShareText,
  type PrincipalReportData,
} from "@/components/reports/principal-report-document";
import { requireOpsContext } from "@/lib/ops-page";
import { formatMoney, pendingMonthsFromAmount } from "@/lib/format";
import {
  brandingForVendorName,
  displayVendorName,
} from "@/lib/vendor-branding";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function toCsv(rows: string[][]) {
  return rows
    .map((r) =>
      r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(","),
    )
    .join("\n");
}

export default async function ReportsPage() {
  const { supabase, profile } = await requireOpsContext();
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  let duesQ = supabase
    .from("fee_dues")
    .select(
      "id, student_id, total_due, amount_paid, status, due_month, due_year",
    )
    .eq("due_month", month)
    .eq("due_year", year);
  let paymentsQ = supabase
    .from("payments")
    .select("amount, status, created_at")
    .eq("status", "approved")
    .gte("created_at", new Date(year, month - 1, 1).toISOString())
    .lt("created_at", new Date(year, month, 1).toISOString());
  let sessionsQ = supabase
    .from("attendance_sessions")
    .select("id, session_date, class_id")
    .gte("session_date", new Date(year, month - 1, 1).toISOString().slice(0, 10))
    .lt("session_date", new Date(year, month, 1).toISOString().slice(0, 10));

  if (profile.vendor_id) {
    duesQ = duesQ.eq("vendor_id", profile.vendor_id);
    paymentsQ = paymentsQ.eq("vendor_id", profile.vendor_id);
    sessionsQ = sessionsQ.eq("vendor_id", profile.vendor_id);
  }
  if (profile.branch_id) {
    duesQ = duesQ.eq("branch_id", profile.branch_id);
    paymentsQ = paymentsQ.eq("branch_id", profile.branch_id);
    sessionsQ = sessionsQ.eq("branch_id", profile.branch_id);
  }

  const [{ data: dues }, { data: payments }, { data: sessions }] =
    await Promise.all([duesQ, paymentsQ, sessionsQ]);

  const invoiced = (dues ?? []).reduce((s, d) => s + Number(d.total_due), 0);
  const collectedFromDues = (dues ?? []).reduce(
    (s, d) => s + Number(d.amount_paid),
    0,
  );
  const collectedPayments = (payments ?? []).reduce(
    (s, p) => s + Number(p.amount),
    0,
  );
  const outstanding = invoiced - collectedFromDues;

  const sessionIds = (sessions ?? []).map((s) => s.id);
  let records: { student_id: string; status: string }[] = [];
  if (sessionIds.length > 0) {
    const { data } = await supabase
      .from("attendance_records")
      .select("student_id, status")
      .in("session_id", sessionIds);
    records = data ?? [];
  }

  const byStudent: Record<string, { present: number; total: number }> = {};
  for (const r of records) {
    if (!byStudent[r.student_id]) {
      byStudent[r.student_id] = { present: 0, total: 0 };
    }
    byStudent[r.student_id].total += 1;
    if (r.status === "present" || r.status === "late") {
      byStudent[r.student_id].present += 1;
    }
  }

  const overdueStudents = dues ?? [];
  const overdueIds = [...new Set(overdueStudents.map((d) => d.student_id))];
  const { data: overdueProfiles } =
    overdueIds.length > 0
      ? await supabase
          .from("students")
          .select("id, full_name, admission_no")
          .in("id", overdueIds)
      : { data: [] as { id: string; full_name: string; admission_no: string }[] };
  const profileById = new Map(
    (overdueProfiles ?? []).map((s) => [s.id, s]),
  );

  const atRisk = overdueStudents
    .map((d) => {
      const st = profileById.get(d.student_id);
      const att = byStudent[d.student_id];
      const pct = att && att.total > 0 ? (att.present / att.total) * 100 : null;
      return {
        student_id: d.student_id,
        name: st?.full_name || d.student_id.slice(0, 8),
        admission_no: st?.admission_no || "",
        balance: Number(d.total_due) - Number(d.amount_paid),
        attendance_pct: pct,
      };
    })
    .filter((r) => r.balance > 0 && (r.attendance_pct === null || r.attendance_pct < 85))
    .slice(0, 50);

  const attendanceRate =
    records.length === 0
      ? null
      : Math.round(
          (records.filter((r) => r.status !== "absent").length / records.length) *
            100,
        );

  let vendorName = "Madarasa";
  let vendorNameAr: string | null = null;
  let logoUrl: string | null = null;
  let branchName = "Branch";
  if (profile.vendor_id) {
    const { data: vendor } = await supabase
      .from("vendors")
      .select("name")
      .eq("id", profile.vendor_id)
      .maybeSingle();
    if (vendor?.name) {
      const branding = brandingForVendorName(vendor.name);
      vendorName = displayVendorName(vendor.name);
      vendorNameAr = branding?.nameAr ?? null;
      logoUrl = branding?.logoUrl ?? null;
    }
  }
  if (profile.branch_id) {
    const { data: branch } = await supabase
      .from("branches")
      .select("name")
      .eq("id", profile.branch_id)
      .maybeSingle();
    if (branch?.name) branchName = branch.name;
  }

  const reportData: PrincipalReportData = {
    vendorName,
    vendorNameAr,
    logoUrl,
    branchName,
    principalName: profile.full_name,
    month,
    year,
    invoiced,
    collectedFromDues,
    collectedPayments,
    outstanding,
    sessionsCount: sessions?.length ?? 0,
    marksCount: records.length,
    attendanceRate,
    atRisk: atRisk.map((r) => ({
      name: r.name,
      admission_no: r.admission_no,
      balance: r.balance,
      attendance_pct: r.attendance_pct,
    })),
  };

  const shareText = buildPrincipalReportShareText(reportData);
  const pdfTitle = `Madarasa-Report-${branchName.replace(/\s+/g, "-")}-${year}-${month}`;

  const collectionCsv = toCsv([
    ["metric", "value"],
    ["month", `${month}/${year}`],
    ["invoiced", String(invoiced)],
    ["collected_from_dues", String(collectedFromDues)],
    ["approved_payments", String(collectedPayments)],
    ["outstanding", String(outstanding)],
  ]);

  const atRiskCsv = toCsv([
    ["student", "admission", "balance", "pending_months", "attendance_pct"],
    ...atRisk.map((r) => [
      r.name,
      r.admission_no,
      String(r.balance),
      String(pendingMonthsFromAmount(r.balance)),
      r.attendance_pct == null ? "" : String(Math.round(r.attendance_pct)),
    ]),
  ]);

  return (
    <OpsShell
      profile={profile}
      title="Reports"
      subtitle="Principal monthly summary — PDF and WhatsApp share"
    >
      <Card className="mb-6 print:hidden">
        <CardHeader>
          <CardTitle>Share &amp; export</CardTitle>
          <CardDescription>
            Download a PDF of this month&apos;s report, or share the summary on
            WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PrincipalReportActions shareText={shareText} title={pdfTitle} />
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-3 print:hidden">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Invoiced ({month}/{year})</CardDescription>
            <CardTitle className="text-2xl">{formatMoney(invoiced)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Collected (dues paid)</CardDescription>
            <CardTitle className="text-2xl">
              {formatMoney(collectedFromDues)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Outstanding</CardDescription>
            <CardTitle className="text-2xl">{formatMoney(outstanding)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 print:hidden">
        <Card>
          <CardHeader>
            <CardTitle>Attendance this month</CardTitle>
            <CardDescription>
              {sessions?.length ?? 0} sessions · {records.length} marks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[#5a6f65]">
              Present/late rate across all marks:{" "}
              {attendanceRate == null ? "—" : `${attendanceRate}%`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export CSV</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <a
              className="rounded-lg border border-[#0b3d2e]/20 px-3 py-2 text-sm"
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(collectionCsv)}`}
              download={`collection-${year}-${month}.csv`}
            >
              Collection CSV
            </a>
            <a
              className="rounded-lg border border-[#0b3d2e]/20 px-3 py-2 text-sm"
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(atRiskCsv)}`}
              download={`at-risk-${year}-${month}.csv`}
            >
              At-risk CSV
            </a>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 print:hidden">
        <CardHeader>
          <CardTitle>At-risk students</CardTitle>
          <CardDescription>
            Open balance this month and attendance under 85% (when available).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AtRiskStudentsList rows={atRisk} />
        </CardContent>
      </Card>

      <div className="mt-8">
        <h2
          className="mb-3 text-lg text-[#0b3d2e] print:hidden sm:text-xl"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          PDF preview
        </h2>
        <PrincipalReportDocument data={reportData} />
      </div>
    </OpsShell>
  );
}
