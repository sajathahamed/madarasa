"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createClassAction, enrollStudentAction } from "@/actions/attendance";
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
  const [classId, setClassId] = useState(classes[0]?.id || "");

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
                  startTransition(async () => {
                    const result = await createClassAction({
                      vendor_id: vendorId,
                      branch_id: branchId,
                      name: String(fd.get("name")),
                      schedule_note: String(fd.get("schedule_note") || "") || undefined,
                    });
                    setMessage(result.error ? result.error : "Class created");
                    if (!result.error) {
                      e.currentTarget.reset();
                      router.refresh();
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
                <Button type="submit" disabled={pending || !vendorId || !branchId} className="bg-[#0b3d2e]">
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
                  const fd = new FormData(e.currentTarget);
                  startTransition(async () => {
                    const result = await enrollStudentAction({
                      class_id: String(fd.get("class_id")),
                      student_id: String(fd.get("student_id")),
                    });
                    setMessage(result.error ? result.error : "Enrolled");
                    if (!result.error) router.refresh();
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
                <div className="space-y-1">
                  <Label>Student</Label>
                  <select
                    name="student_id"
                    required
                    className="h-9 w-full rounded-lg border border-input bg-background px-2"
                  >
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} ({s.admission_no})
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" disabled={pending || classes.length === 0} variant="outline">
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
          {classes.map((c) => {
            const members = enrollments.filter(
              (e) => e.class_id === c.id && e.is_active,
            );
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
                      students
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
                    </li>
                  ))}
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
