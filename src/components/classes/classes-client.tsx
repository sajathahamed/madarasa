"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createClassAction, enrollStudentAction } from "@/actions/attendance";
import { StudentSearchInput } from "@/components/students/student-search-input";
import { StudentSearchSelect } from "@/components/students/student-search-select";
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

type Klass = {
  id: string;
  name: string;
  schedule_note: string | null;
  branch_id: string;
};
type Student = { id: string; full_name: string; admission_no: string };
type Enrollment = {
  id: string;
  class_id: string;
  student_id: string;
  is_active: boolean;
  student_name?: string;
  admission_no?: string;
};

export function ClassesClient({
  vendorId,
  branchId,
  classes,
  students,
  enrollments,
  canManage,
}: {
  vendorId: string;
  branchId: string;
  classes: Klass[];
  students: Student[];
  enrollments: Enrollment[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [classId, setClassId] = useState(classes[0]?.id || "");
  const [studentId, setStudentId] = useState("");
  const [rosterQuery, setRosterQuery] = useState("");

  const admissionById = useMemo(
    () => new Map(students.map((s) => [s.id, s.admission_no])),
    [students],
  );

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm">{message}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {canManage ? (
          <Card>
            <CardHeader>
              <CardTitle>New class</CardTitle>
              <CardDescription>Section for attendance and progress.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  setPendingAction("create");
                  startTransition(async () => {
                    try {
                      const result = await createClassAction({
                        vendor_id: vendorId,
                        branch_id: branchId,
                        name: String(fd.get("name")),
                        schedule_note:
                          String(fd.get("schedule_note") || "") || undefined,
                      });
                      setMessage(result.error ? result.error : "Class created");
                      if (!result.error) {
                        e.currentTarget.reset();
                        router.refresh();
                      }
                    } finally {
                      setPendingAction(null);
                    }
                  });
                }}
              >
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input name="name" required placeholder="Hifz A / Qaida 1" />
                </div>
                <div className="space-y-1">
                  <Label>Schedule note</Label>
                  <Input name="schedule_note" placeholder="Sat–Sun 8–10am" />
                </div>
                <Button
                  type="submit"
                  pending={pending && pendingAction === "create"}
                  pendingLabel="Creating…"
                  disabled={pending || !vendorId || !branchId}
                  className="bg-[#0b3d2e]"
                >
                  Create class
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        {canManage ? (
          <Card>
            <CardHeader>
              <CardTitle>Enroll student</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  setPendingAction("enroll");
                  startTransition(async () => {
                    try {
                      const result = await enrollStudentAction({
                        class_id: classId,
                        student_id: studentId,
                      });
                      setMessage(result.error ? result.error : "Enrolled");
                      if (!result.error) {
                        setStudentId("");
                        router.refresh();
                      }
                    } finally {
                      setPendingAction(null);
                    }
                  });
                }}
              >
                <div className="space-y-1">
                  <Label>Class</Label>
                  <select
                    name="class_id"
                    required
                    className="h-9 w-full rounded-lg border border-input bg-background px-2"
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <StudentSearchSelect
                  students={students}
                  value={studentId}
                  onChange={setStudentId}
                  required
                />
                <Button
                  type="submit"
                  pending={pending && pendingAction === "enroll"}
                  pendingLabel="Enrolling…"
                  disabled={pending || classes.length === 0 || !studentId}
                  variant="outline"
                >
                  Enroll
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Classes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <StudentSearchInput
            value={rosterQuery}
            onChange={setRosterQuery}
            placeholder="Filter roster by name or ID…"
          />
          {classes.map((c) => {
            const members = enrollments.filter((e) => {
              if (e.class_id !== c.id || !e.is_active) return false;
              return matchesStudentQuery(
                {
                  student_name: e.student_name,
                  admission_no:
                    e.admission_no || admissionById.get(e.student_id),
                },
                rosterQuery,
              );
            });
            return (
              <div
                key={c.id}
                className="rounded-lg border border-[#0b3d2e]/10 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-[#0b3d2e]">{c.name}</p>
                    <p className="text-xs text-[#5a6f65]">
                      {c.schedule_note || "No schedule note"} · {members.length}{" "}
                      shown
                    </p>
                  </div>
                  <Link
                    href={`/branch/attendance?class=${c.id}`}
                    className="text-sm underline"
                  >
                    Mark attendance
                  </Link>
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {members.map((m) => (
                    <li key={m.id}>
                      <Link
                        href={`/branch/students/${m.student_id}`}
                        className="underline"
                      >
                        {m.student_name || m.student_id.slice(0, 8)}
                      </Link>
                      <span className="text-[#5a6f65]">
                        {" "}
                        (
                        {m.admission_no ||
                          admissionById.get(m.student_id) ||
                          "—"}
                        )
                      </span>
                    </li>
                  ))}
                  {members.length === 0 ? (
                    <li className="text-[#5a6f65]">No matching students.</li>
                  ) : null}
                </ul>
              </div>
            );
          })}
          {classes.length === 0 ? (
            <p className="text-sm text-[#5a6f65]">No classes yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
