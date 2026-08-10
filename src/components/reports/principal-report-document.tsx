import { formatMoney } from "@/lib/format";

export type PrincipalReportData = {
  vendorName: string;
  branchName: string;
  principalName: string;
  month: number;
  year: number;
  invoiced: number;
  collectedFromDues: number;
  collectedPayments: number;
  outstanding: number;
  sessionsCount: number;
  marksCount: number;
  attendanceRate: number | null;
  atRisk: {
    name: string;
    admission_no: string;
    balance: number;
    attendance_pct: number | null;
  }[];
};

export function buildPrincipalReportShareText(data: PrincipalReportData) {
  const period = `${data.month}/${data.year}`;
  const lines = [
    `*Madarasa — ${data.vendorName}*`,
    `Branch: ${data.branchName}`,
    `Report: ${period}`,
    `Prepared by: ${data.principalName}`,
    "",
    `Invoiced: ${formatMoney(data.invoiced)}`,
    `Collected (dues): ${formatMoney(data.collectedFromDues)}`,
    `Approved payments: ${formatMoney(data.collectedPayments)}`,
    `Outstanding: ${formatMoney(data.outstanding)}`,
    `Attendance sessions: ${data.sessionsCount}`,
    `Attendance rate: ${
      data.attendanceRate == null ? "—" : `${data.attendanceRate}%`
    }`,
    "",
    `At-risk students (${data.atRisk.length}):`,
  ];

  if (data.atRisk.length === 0) {
    lines.push("None flagged this month.");
  } else {
    for (const r of data.atRisk.slice(0, 25)) {
      const att =
        r.attendance_pct == null ? "n/a" : `${Math.round(r.attendance_pct)}%`;
      lines.push(
        `• ${r.name} (${r.admission_no || "—"}) — ${formatMoney(r.balance)} · att ${att}`,
      );
    }
    if (data.atRisk.length > 25) {
      lines.push(`…and ${data.atRisk.length - 25} more`);
    }
  }

  lines.push("", "_Shared from Madarasa principal reports_");
  return lines.join("\n");
}

export function PrincipalReportDocument({ data }: { data: PrincipalReportData }) {
  const periodLabel = new Date(data.year, data.month - 1, 1).toLocaleString(
    undefined,
    { month: "long", year: "numeric" },
  );

  return (
    <article
      id="principal-report"
      className="rounded-xl border border-[#0b3d2e]/15 bg-white p-4 sm:p-8 print:border-0 print:p-0 print:shadow-none"
    >
      <header className="mb-6 border-b border-[#0b3d2e]/10 pb-4">
        <p
          className="text-xl text-[#0b3d2e] sm:text-2xl"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          {data.vendorName}
        </p>
        <p className="text-sm text-[#5a6f65]">{data.branchName}</p>
        <h2 className="mt-3 text-lg font-medium text-[#0b3d2e] sm:text-xl">
          Monthly principal report — {periodLabel}
        </h2>
        <p className="mt-1 text-xs text-[#5a6f65]">
          Prepared by {data.principalName} · Generated{" "}
          {new Date().toLocaleString()}
        </p>
      </header>

      <section className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[#0b3d2e]/10 p-3">
          <p className="text-xs uppercase tracking-wide text-[#5a6f65]">
            Invoiced
          </p>
          <p className="mt-1 text-xl text-[#0b3d2e]">
            {formatMoney(data.invoiced)}
          </p>
        </div>
        <div className="rounded-lg border border-[#0b3d2e]/10 p-3">
          <p className="text-xs uppercase tracking-wide text-[#5a6f65]">
            Collected (dues paid)
          </p>
          <p className="mt-1 text-xl text-[#0b3d2e]">
            {formatMoney(data.collectedFromDues)}
          </p>
        </div>
        <div className="rounded-lg border border-[#0b3d2e]/10 p-3">
          <p className="text-xs uppercase tracking-wide text-[#5a6f65]">
            Approved payments
          </p>
          <p className="mt-1 text-xl text-[#0b3d2e]">
            {formatMoney(data.collectedPayments)}
          </p>
        </div>
        <div className="rounded-lg border border-[#0b3d2e]/10 p-3">
          <p className="text-xs uppercase tracking-wide text-[#5a6f65]">
            Outstanding
          </p>
          <p className="mt-1 text-xl text-[#0b3d2e]">
            {formatMoney(data.outstanding)}
          </p>
        </div>
      </section>

      <section className="mb-6">
        <h3 className="mb-2 font-medium text-[#0b3d2e]">Attendance</h3>
        <p className="text-sm text-[#5a6f65]">
          {data.sessionsCount} sessions · {data.marksCount} marks · Present/late
          rate:{" "}
          {data.attendanceRate == null ? "—" : `${data.attendanceRate}%`}
        </p>
      </section>

      <section>
        <h3 className="mb-2 font-medium text-[#0b3d2e]">
          At-risk students ({data.atRisk.length})
        </h3>
        <p className="mb-3 text-xs text-[#5a6f65]">
          Open balance this month and attendance under 85% (when available).
        </p>
        {data.atRisk.length === 0 ? (
          <p className="text-sm text-[#5a6f65]">No at-risk students flagged.</p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="border-b border-[#0b3d2e]/10 text-[#5a6f65]">
                <tr>
                  <th className="px-2 py-2 font-medium">Student</th>
                  <th className="px-2 py-2 font-medium">Admission</th>
                  <th className="px-2 py-2 font-medium">Balance</th>
                  <th className="px-2 py-2 font-medium">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {data.atRisk.map((r) => (
                  <tr
                    key={`${r.admission_no}-${r.name}`}
                    className="border-b border-[#0b3d2e]/5"
                  >
                    <td className="px-2 py-2">{r.name}</td>
                    <td className="px-2 py-2">{r.admission_no || "—"}</td>
                    <td className="px-2 py-2">{formatMoney(r.balance)}</td>
                    <td className="px-2 py-2">
                      {r.attendance_pct == null
                        ? "—"
                        : `${Math.round(r.attendance_pct)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-8 text-center text-xs text-[#5a6f65]">
        Madarasa principal report · Confidential branch summary
      </p>
    </article>
  );
}
