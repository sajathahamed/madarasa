"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { saveAttendanceAction } from "@/actions/attendance";
import { StudentSearchInput } from "@/components/students/student-search-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { matchesStudentQuery } from "@/lib/student-search";
import type { AttendanceStatus } from "@/types/database";

type Klass = { id: string; name: string };
type Member = { student_id: string; full_name: string; admission_no: string };

export function AttendanceClient({
  classes,
  membersByClass,
  initialClassId,
  canMark,
}: {
  classes: Klass[];
  membersByClass: Record<string, Member[]>;
  initialClassId?: string;
  canMark: boolean;
}) {
  const router = useRouter();
  const [classId, setClassId] = useState(
    initialClassId || classes[0]?.id || "",
  );
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [notify, setNotify] = useState(true);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const members = useMemo(
    () => membersByClass[classId] || [],
    [membersByClass, classId],
  );

  const visibleMembers = useMemo(
    () => members.filter((m) => matchesStudentQuery(m, query)),
    [members, query],
  );

  const setAll = (status: AttendanceStatus) => {
    const next: Record<string, AttendanceStatus> = { ...marks };
    visibleMembers.forEach((m) => {
      next[m.student_id] = status;
    });
    setMarks(next);
  };

  if (!canMark) {
    return (
      <p className="text-sm text-[#5a6f65]">
        Your role cannot mark attendance.
      </p>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily register</CardTitle>
        <CardDescription>
          Tap present / absent / late. Absences can WhatsApp guardians.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message ? <p className="text-sm">{message}</p> : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Class</Label>
            <select
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setMarks({});
                setQuery("");
              }}
              className="h-10 w-full rounded-lg border border-input bg-background px-2 md:h-9"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setAll("present")}>
              All present
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setAll("absent")}>
              All absent
            </Button>
          </div>
        </div>

        <StudentSearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search student name or ID…"
          className="max-w-none"
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
          />
          WhatsApp guardians for absent / late
        </label>

        <ul className="space-y-3">
          {visibleMembers.map((m) => {
            const status = marks[m.student_id] || "present";
            return (
              <li
                key={m.student_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#0b3d2e]/10 p-3"
              >
                <div>
                  <p className="font-medium">{m.full_name}</p>
                  <p className="text-xs text-[#5a6f65]">{m.admission_no}</p>
                </div>
                <div className="flex gap-1">
                  {(["present", "late", "absent"] as AttendanceStatus[]).map(
                    (s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() =>
                          setMarks((prev) => ({
                            ...prev,
                            [m.student_id]: s,
                          }))
                        }
                        className={`min-h-10 min-w-16 rounded-lg px-3 text-sm capitalize ${
                          status === s
                            ? "bg-[#0b3d2e] text-white"
                            : "border border-[#0b3d2e]/20"
                        }`}
                      >
                        {s}
                      </button>
                    ),
                  )}
                </div>
              </li>
            );
          })}
          {visibleMembers.length === 0 ? (
            <li className="text-sm text-[#5a6f65]">
              {members.length === 0
                ? "Enroll students in this class first."
                : "No students match your search."}
            </li>
          ) : null}
        </ul>

        <Button
          type="button"
          pending={pending}
          pendingLabel="Saving…"
          disabled={!classId || members.length === 0}
          className="bg-[#0b3d2e]"
          onClick={() => {
            startTransition(async () => {
              const result = await saveAttendanceAction({
                class_id: classId,
                session_date: date,
                notify_absences: notify,
                records: members.map((m) => ({
                  student_id: m.student_id,
                  status: marks[m.student_id] || "present",
                })),
              });
              setMessage(result.error ? result.error : "Attendance saved");
              if (!result.error) router.refresh();
            });
          }}
        >
          Save attendance
        </Button>
      </CardContent>
    </Card>
  );
}
