"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { StudentSearchInput } from "@/components/students/student-search-input";
import { formatMoney, formatPendingMonths } from "@/lib/format";
import { matchesStudentQuery } from "@/lib/student-search";

type Row = {
  student_id: string;
  name: string;
  admission_no: string;
  balance: number;
  attendance_pct: number | null;
};

export function AtRiskStudentsList({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () =>
      rows.filter((r) =>
        matchesStudentQuery(
          { full_name: r.name, admission_no: r.admission_no },
          q,
        ),
      ),
    [rows, q],
  );

  return (
    <div className="space-y-3">
      <StudentSearchInput value={q} onChange={setQ} />
      <ul className="space-y-2 text-sm">
        {filtered.map((r) => (
          <li
            key={r.student_id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#0b3d2e]/10 px-3 py-2"
          >
            <div>
              <Link
                href={`/branch/students/${r.student_id}`}
                className="underline"
              >
                {r.name}
              </Link>
              {r.admission_no ? (
                <p className="text-xs text-[#5a6f65]">{r.admission_no}</p>
              ) : null}
            </div>
            <span>
              {formatMoney(r.balance)} · {formatPendingMonths(r.balance)}
              {r.attendance_pct != null
                ? ` · ${Math.round(r.attendance_pct)}% att`
                : ""}
            </span>
          </li>
        ))}
        {filtered.length === 0 ? (
          <li className="text-[#5a6f65]">
            {rows.length === 0
              ? "No at-risk students flagged."
              : "No students match your search."}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
