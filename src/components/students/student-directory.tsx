"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";

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
    const needle = q.trim().toLowerCase();
    return students.filter((s) => {
      if (status !== "all" && s.status !== status) return false;
      if (!needle) return true;
      return (
        s.full_name.toLowerCase().includes(needle) ||
        s.admission_no.toLowerCase().includes(needle) ||
        s.guardian_phone.includes(needle)
      );
    });
  }, [students, q, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search name, admission, phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="left">Left</option>
          <option value="graduated">Graduated</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#0b3d2e]/10 bg-white/70">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#0b3d2e]/10 text-[#5a6f65]">
            <tr>
              <th className="px-3 py-2 font-medium">Student</th>
              <th className="px-3 py-2 font-medium">Admission</th>
              <th className="px-3 py-2 font-medium">Guardian</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-b border-[#0b3d2e]/5">
                <td className="px-3 py-2">
                  <Link
                    href={`/branch/students/${s.id}`}
                    className="font-medium text-[#0b3d2e] underline"
                  >
                    {s.full_name}
                  </Link>
                  {s.branch_name ? (
                    <p className="text-xs text-[#5a6f65]">{s.branch_name}</p>
                  ) : null}
                </td>
                <td className="px-3 py-2">{s.admission_no}</td>
                <td className="px-3 py-2">{s.guardian_phone}</td>
                <td className="px-3 py-2">
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
  );
}
