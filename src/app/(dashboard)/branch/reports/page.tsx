import { OpsShell } from "@/components/layout/ops-shell";
import { AtRiskStudentsList } from "@/components/students/at-risk-students-list";
import { DownloadExcelButton } from "@/components/reports/download-excel-button";
import { PrincipalReportActions } from "@/components/reports/principal-report-actions";
import {
  PrincipalReportDocument,
  buildPrincipalReportShareText,
  type PrincipalReportData,
} from "@/components/reports/principal-report-document";
import { ensureMonthlyFeeDues } from "@/lib/fees/ensure-monthly-dues";
import type { ExcelSheet } from "@/lib/excel-sheet";
import { requireOpsContext } from "@/lib/ops-page";
import {
  formatDate,
  formatMoney,
  pendingMonthsFromAmount,
} from "@/lib/format";
import { fetchAll } from "@/lib/supabase/fetch-all";
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
  await ensureMonthlyFeeDues();

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthStart = new Date(year, month - 1, 1).toISOString();
  const nextMonthStart = new Date(year, month, 1).toISOString();
  const monthStartDate = monthStart.slice(0, 10);
  const nextMonthDate = nextMonthStart.slice(0, 10);

  const [dues, payments, sessions, students] = await Promise.all([
    fetchAll<{
      id: string;
      student_id: string;
      total_due: number;
      amount_paid: number;
      status: string;
      due_month: number;
      due_year: number;
      month_amount: number;
      carried_forward: number;
    }>((from, to) => {
      let query = supabase
        .from("fee_dues")
        .select(
          "id, student_id, total_due, amount_paid, status, due_month, due_year, month_amount, carried_forward",
        )
        .eq("due_month", month)
        .eq("due_year", year)
        .order("id");
      if (profile.vendor_id) query = query.eq("vendor_id", profile.vendor_id);
      if (profile.branch_id) query = query.eq("branch_id", profile.branch_id);
      return query.range(from, to);
    }),
    fetchAll<{
      amount: number;
      status: string;
      method: string;
      created_at: string;
      student_id: string;
    }>((from, to) => {
      let query = supabase
        .from("payments")
        .select("amount, status, method, created_at, student_id")
        .gte("created_at", monthStart)
        .lt("created_at", nextMonthStart)
        .order("created_at");
      if (profile.vendor_id) query = query.eq("vendor_id", profile.vendor_id);
      if (profile.branch_id) query = query.eq("branch_id", profile.branch_id);
      return query.range(from, to);
    }),
    fetchAll<{ id: string; session_date: string; class_id: string }>((from, to) => {
      let query = supabase
        .from("attendance_sessions")
        .select("id, session_date, class_id")
        .gte("session_date", monthStartDate)
        .lt("session_date", nextMonthDate)
        .order("id");
      if (profile.vendor_id) query = query.eq("vendor_id", profile.vendor_id);
      if (profile.branch_id) query = query.eq("branch_id", profile.branch_id);
      return query.range(from, to);
    }),
    fetchAll<{ id: string; full_name: string; admission_no: string }>((from, to) => {
      let query = supabase
        .from("students")
        .select("id, full_name, admission_no")
        .order("full_name");
      if (profile.vendor_id) query = query.eq("vendor_id", profile.vendor_id);
      if (profile.branch_id) query = query.eq("branch_id", profile.branch_id);
      return query.range(from, to);
    }),
  ]);

  const approvedPayments = payments.filter((p) => p.status === "approved");
  const invoiced = dues.reduce((s, d) => s + Number(d.total_due), 0);
  const collectedFromDues = dues.reduce((s, d) => s + Number(d.amount_paid), 0);
  const collectedPayments = approvedPayments.reduce(
    (s, p) => s + Number(p.amount),
    0,
  );
  const outstanding = invoiced - collectedFromDues;

  const sessionIds = sessions.map((s) => s.id);
  const records: { student_id: string; status: string }[] = [];
  for (let i = 0; i < sessionIds.length; i += 100) {
    const slice = sessionIds.slice(i, i + 100);
    const { data } = await supabase
      .from("attendance_records")
      .select("student_id, status")
      .in("session_id", slice);
    records.push(...(data ?? []));
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

  const profileById = new Map(students.map((s) => [s.id, s]));

  const atRisk = dues
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
    sessionsCount: sessions.length,
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

  const dueRows = [...dues].sort((a, b) => {
    const an = profileById.get(a.student_id)?.full_name ?? "";
    const bn = profileById.get(b.student_id)?.full_name ?? "";
    return an.localeCompare(bn);
  });

  const excelSheets: ExcelSheet[] = [
    {
      name: "Summary",
      rows: [
        ["Madarasa monthly report"],
        ["Branch", branchName],
        ["Prepared by", profile.full_name],
        ["Month", `${month}/${year}`],
        ["Invoiced", invoiced],
        ["Collected from dues", collectedFromDues],
        ["Approved payments", collectedPayments],
        ["Outstanding", outstanding],
        ["Attendance sessions", sessions.length],
        ["Attendance marks", records.length],
        ["Attendance rate %", attendanceRate ?? ""],
      ],
    },
    {
      name: "Monthly dues",
      rows: [
        [
          "Student",
          "Admission",
          "Month amount",
          "Carried forward",
          "Total due",
          "Paid",
          "Balance",
          "Pending months",
          "Status",
        ],
        ...dueRows.map((d) => {
          const st = profileById.get(d.student_id);
          const balance = Number(d.total_due) - Number(d.amount_paid);
          return [
            st?.full_name ?? "",
            st?.admission_no ?? "",
            Number(d.month_amount),
            Number(d.carried_forward),
            Number(d.total_due),
            Number(d.amount_paid),
            balance,
            pendingMonthsFromAmount(balance),
            d.status,
          ];
        }),
      ],
    },
    {
      name: "At risk",
      rows: [
        ["Student", "Admission", "Balance", "Pending months", "Attendance %"],
        ...atRisk.map((r) => [
          r.name,
          r.admission_no,
          r.balance,
          pendingMonthsFromAmount(r.balance),
          r.attendance_pct == null ? "" : Math.round(r.attendance_pct),
        ]),
      ],
    },
    {
      name: "Attendance",
      rows: [
        ["Student", "Admission", "Present or late", "Marks", "Attendance %"],
        ...Object.entries(byStudent)
          .map(([studentId, att]) => {
            const st = profileById.get(studentId);
            const pct = att.total > 0 ? Math.round((att.present / att.total) * 100) : 0;
            return [
              st?.full_name ?? studentId.slice(0, 8),
              st?.admission_no ?? "",
              att.present,
              att.total,
              pct,
            ] as (string | number)[];
          })
          .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      ],
    },
    {
      name: "Payments",
      rows: [
        ["Date", "Student", "Admission", "Amount", "Method", "Status"],
        ...payments.map((p) => {
          const st = profileById.get(p.student_id);
          return [
            formatDate(p.created_at),
            st?.full_name ?? "",
            st?.admission_no ?? "",
            Number(p.amount),
            p.method,
            p.status,
          ];
        }),
      ],
    },
  ];

  return (
    <OpsShell
      profile={profile}
      title="Reports"
      subtitle="Principal monthly summary — Excel, PDF, and WhatsApp"
    >
      <Card className="mb-6 print:hidden">
        <CardHeader>
          <CardTitle>Share &amp; export</CardTitle>
          <CardDescription>
            Download this month&apos;s report as Excel or PDF, or share the
            summary on WhatsApp. The Excel file includes the summary, every
            student&apos;s dues, at-risk students, attendance, and payments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DownloadExcelButton
            filename={`${pdfTitle}.xls`}
            sheets={excelSheets}
          />
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
              {sessions.length} sessions · {records.length} marks
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
