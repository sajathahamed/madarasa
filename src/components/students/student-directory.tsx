"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { StudentSearchInput } from "@/components/students/student-search-input";
import { StatusBadge } from "@/components/ui/status-badge";
import { matchesStudentQuery } from "@/lib/student-search";

type Row = {
  id: string;
  full_name: string;
  admission_no: string;
  guardian_phone: string;
  status: string;
  branch_name?: string;
};

export function StudentDirectory({ students }: { students: Row[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (status !== "all" && s.status !== status) return false;
      return matchesStudentQuery(s, q);
    });
  }, [students, q, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <StudentSearchInput value={q} onChange={setQ} />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm sm:w-auto md:h-9"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="left">Left</option>
          <option value="graduated">Graduated</option>
        </select>
      </div>

      <div className="-mx-4 overflow-x-auto overscroll-x-contain px-4 sm:mx-0 sm:px-0">
        <div className="overflow-hidden rounded-xl border border-[#0b3d2e]/10 bg-white/70">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead className="border-b border-[#0b3d2e]/10 text-[#5a6f65]">
              <tr>
                <th className="px-3 py-2.5 font-medium">Student</th>
                <th className="px-3 py-2.5 font-medium">Admission</th>
                <th className="hidden px-3 py-2.5 font-medium sm:table-cell">
                  Guardian
                </th>
                <th className="px-3 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-[#0b3d2e]/5">
                  <td className="px-3 py-3">
                    <Link
                      href={`/branch/students/${s.id}`}
                      className="font-medium text-[#0b3d2e] underline"
                    >
                      {s.full_name}
                    </Link>
                    {s.branch_name ? (
                      <p className="text-xs text-[#5a6f65]">{s.branch_name}</p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-[#5a6f65] sm:hidden">
                      {s.guardian_phone}
                    </p>
                  </td>
                  <td className="px-3 py-3">{s.admission_no}</td>
                  <td className="hidden px-3 py-3 sm:table-cell">
                    {s.guardian_phone}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge value={s.status} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-[#5a6f65]">
                    No students match.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
