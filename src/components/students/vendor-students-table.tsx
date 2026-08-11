"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { StudentSearchInput } from "@/components/students/student-search-input";
import { EmptyRow } from "@/components/layout/panel-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/format";
import { matchesStudentQuery } from "@/lib/student-search";

type Row = {
  id: string;
  admission_no: string;
  full_name: string;
  guardian_name: string;
  guardian_phone: string;
  status: string;
  branch_id: string;
  created_at: string;
};

export function VendorStudentsTable({
  students,
  branchMap,
}: {
  students: Row[];
  branchMap: Record<string, string>;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () => students.filter((s) => matchesStudentQuery(s, q)),
    [students, q],
  );

  return (
    <section id="students" className="mt-8">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h2
            className="text-lg text-[#0b3d2e] sm:text-xl"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            Students
          </h2>
          <p className="text-sm text-[#5a6f65]">
            Search by name or admission ID. Left students show in rose.
          </p>
        </div>
        <StudentSearchInput value={q} onChange={setQ} />
      </div>
      <div className="-mx-4 overflow-x-auto overscroll-x-contain px-4 sm:mx-0 sm:px-0">
        <div className="overflow-hidden rounded-lg border border-[#0b3d2e]/10 bg-white/70">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-[#0b3d2e]/5 text-left">
              <tr>
                {[
                  "Admission",
                  "Name",
                  "Guardian",
                  "Phone",
                  "Branch",
                  "Status",
                  "Joined",
                ].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
          <tbody>
            {filtered.length === 0 ? (
              <EmptyRow colSpan={7}>
                {students.length === 0 ? (
                  <>
                    No students yet. Add them from{" "}
                    <Link href="/branch/students" className="underline">
                      Students
                    </Link>
                    .
                  </>
                ) : (
                  "No students match your search."
                )}
              </EmptyRow>
            ) : (
              filtered.map((s) => (
                <tr
                  key={s.id}
                  className={
                    s.status === "left"
                      ? "border-t border-rose-200 bg-rose-50/90"
                      : s.status === "graduated"
                        ? "border-t border-sky-100 bg-sky-50/50"
                        : "border-t border-[#0b3d2e]/8"
                  }
                >
                  <td className="px-3 py-2">{s.admission_no}</td>
                  <td
                    className={
                      s.status === "left"
                        ? "px-3 py-2 font-medium text-rose-900"
                        : "px-3 py-2 font-medium"
                    }
                  >
                    <Link
                      href={`/branch/students/${s.id}`}
                      className="underline"
                    >
                      {s.full_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{s.guardian_name}</td>
                  <td className="px-3 py-2">{s.guardian_phone}</td>
                  <td className="px-3 py-2">
                    {branchMap[s.branch_id] || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge value={s.status} />
                  </td>
                  <td className="px-3 py-2">{formatDate(s.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </section>
  );
}
