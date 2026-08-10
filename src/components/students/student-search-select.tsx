"use client";

import { useMemo, useState } from "react";

import { StudentSearchInput } from "@/components/students/student-search-input";
import { Label } from "@/components/ui/label";
import { matchesStudentQuery } from "@/lib/student-search";

export type SearchableStudent = {
  id: string;
  full_name: string;
  admission_no: string;
};

export function StudentSearchSelect({
  students,
  value,
  onChange,
  name = "student_id",
  id = "student_id",
  label = "Student",
  required = false,
  emptyLabel = "Select student",
}: {
  students: SearchableStudent[];
  value: string;
  onChange: (studentId: string) => void;
  name?: string;
  id?: string;
  label?: string;
  required?: boolean;
  emptyLabel?: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => students.filter((s) => matchesStudentQuery(s, query)),
    [students, query],
  );

  const selected = students.find((s) => s.id === value);
  const options =
    selected && !filtered.some((s) => s.id === selected.id)
      ? [selected, ...filtered]
      : filtered;

  return (
    <div className="space-y-1">
      {label ? <Label htmlFor={`${id}-search`}>{label}</Label> : null}
      <StudentSearchInput
        id={`${id}-search`}
        value={query}
        onChange={setQuery}
        className="max-w-none"
      />
      <select
        id={id}
        name={name}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
      >
        <option value="">{emptyLabel}</option>
        {options.map((s) => (
          <option key={s.id} value={s.id}>
            {s.admission_no} — {s.full_name}
          </option>
        ))}
      </select>
      {query.trim() ? (
        <p className="text-xs text-[#5a6f65]">
          {filtered.length} match{filtered.length === 1 ? "" : "es"}
        </p>
      ) : null}
    </div>
  );
}
