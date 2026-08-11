"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  adminDeleteAttendanceSessionAction,
  adminDeleteClassAction,
  adminDeleteDonationAction,
  adminDeleteFeeDueAction,
  adminDeletePaymentAction,
  adminDeleteProgressLogAction,
  adminDeleteStudentAction,
} from "@/actions/admin-ops";
import { StudentSearchInput } from "@/components/students/student-search-input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate, formatMoney } from "@/lib/format";
import { matchesStudentQuery } from "@/lib/student-search";

type Tab =
  | "payments"
  | "donations"
  | "students"
  | "dues"
  | "attendance"
  | "progress"
  | "classes";

type Payment = {
  id: string;
  amount: number;
  status: string;
  method: string;
  created_at: string;
  student_name?: string;
  admission_no?: string;
};

type Donation = {
  id: string;
  amount: number;
  status: string;
  donor_name: string;
  created_at: string;
};

type Student = {
  id: string;
  full_name: string;
  admission_no: string;
  status: string;
  guardian_phone: string;
};

type Due = {
  id: string;
  due_month: number;
  due_year: number;
  total_due: number;
  amount_paid: number;
  status: string;
  student_name?: string;
  admission_no?: string;
};

type AttendanceSession = {
  id: string;
  session_date: string;
  class_name?: string;
};

type ProgressLog = {
  id: string;
  logged_at: string;
  stream: string;
  student_name?: string;
  lesson_ref?: string | null;
};

type ClassRow = {
  id: string;
  name: string;
};

export function AdminOpsClient({
  payments,
  donations,
  students,
  dues,
  attendanceSessions,
  progressLogs,
  classes,
}: {
  payments: Payment[];
  donations: Donation[];
  students: Student[];
  dues: Due[];
  attendanceSessions: AttendanceSession[];
  progressLogs: ProgressLog[];
  classes: ClassRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("payments");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const tabs: { id: Tab; label: string }[] = [
    { id: "payments", label: "Payments" },
    { id: "donations", label: "Donations" },
    { id: "students", label: "Students" },
    { id: "dues", label: "Fee dues" },
    { id: "attendance", label: "Attendance" },
    { id: "progress", label: "Progress" },
    { id: "classes", label: "Classes" },
  ];

  const runDelete = (
    id: string,
    confirmText: string,
    fn: () => Promise<{ error?: string }>,
  ) => {
    if (!window.confirm(confirmText)) return;
    setPendingId(id);
    startTransition(async () => {
      try {
        const result = await fn();
        setMessage(result.error ? result.error : "Deleted successfully");
        if (!result.error) router.refresh();
      } finally {
        setPendingId(null);
      }
    });
  };

  const filteredStudents = useMemo(
    () =>
      students.filter((s) =>
        matchesStudentQuery(
          {
            full_name: s.full_name,
            admission_no: s.admission_no,
            guardian_phone: s.guardian_phone,
          },
          query,
        ),
      ),
    [students, query],
  );

  const filteredPayments = useMemo(
    () =>
      payments.filter((p) =>
        matchesStudentQuery(
          {
            student_name: p.student_name,
            admission_no: p.admission_no,
          },
          query,
        ),
      ),
    [payments, query],
  );

  const filteredDues = useMemo(
    () =>
      dues.filter((d) =>
        matchesStudentQuery(
          {
            student_name: d.student_name,
            admission_no: d.admission_no,
          },
          query,
        ),
      ),
    [dues, query],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Admin delete dashboard</CardTitle>
          <CardDescription>
            Principal / vendor admin can permanently remove mistaken records.
            Approved payments and donations reverse ledger and fee balances.
            Students are marked Left (soft delete).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {tabs.map((t) => (
              <Button
                key={t.id}
                type="button"
                size="sm"
                variant={tab === t.id ? "default" : "outline"}
                className={tab === t.id ? "bg-[#0b3d2e]" : undefined}
                onClick={() => {
                  setTab(t.id);
                  setQuery("");
                  setMessage(null);
                }}
              >
                {t.label}
              </Button>
            ))}
          </div>
          <StudentSearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search by name, ID, or phone…"
            className="max-w-md"
          />
          {message ? (
            <p
              className={`rounded-lg border px-3 py-2 text-sm ${
                message.toLowerCase().includes("success")
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-amber-200 bg-amber-50 text-amber-950"
              }`}
            >
              {message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {tab === "payments" ? (
        <Card>
          <CardHeader>
            <CardTitle>Payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredPayments.map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-2 rounded-lg border border-[#0b3d2e]/10 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium">
                    {p.student_name || "Student"} · {formatMoney(p.amount)}
                  </p>
                  <p className="text-[#5a6f65]">
                    {p.admission_no} · {p.status} · {p.method} ·{" "}
                    {formatDate(p.created_at)}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-red-300 text-red-800"
                  pending={pending && pendingId === p.id}
                  pendingLabel="Deleting…"
                  disabled={pending}
                  onClick={() =>
                    runDelete(
                      p.id,
                      `Delete payment of ${formatMoney(p.amount)} (${p.status})?`,
                      () => adminDeletePaymentAction(p.id),
                    )
                  }
                >
                  Delete
                </Button>
              </div>
            ))}
            {filteredPayments.length === 0 ? (
              <p className="text-sm text-[#5a6f65]">No payments found.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {tab === "donations" ? (
        <Card>
          <CardHeader>
            <CardTitle>Donations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {donations
              .filter((d) =>
                !query.trim()
                  ? true
                  : d.donor_name.toLowerCase().includes(query.trim().toLowerCase()),
              )
              .map((d) => (
                <div
                  key={d.id}
                  className="flex flex-col gap-2 rounded-lg border border-[#0b3d2e]/10 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="text-sm">
                    <p className="font-medium">
                      {d.donor_name} · {formatMoney(d.amount)}
                    </p>
                    <p className="text-[#5a6f65]">
                      {d.status} · {formatDate(d.created_at)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-800"
                    pending={pending && pendingId === d.id}
                    pendingLabel="Deleting…"
                    disabled={pending}
                    onClick={() =>
                      runDelete(
                        d.id,
                        `Delete donation from ${d.donor_name}?`,
                        () => adminDeleteDonationAction(d.id),
                      )
                    }
                  >
                    Delete
                  </Button>
                </div>
              ))}
          </CardContent>
        </Card>
      ) : null}

      {tab === "students" ? (
        <Card>
          <CardHeader>
            <CardTitle>Students</CardTitle>
            <CardDescription>Marks student as Left (keeps history).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredStudents.map((s) => (
              <div
                key={s.id}
                className="flex flex-col gap-2 rounded-lg border border-[#0b3d2e]/10 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="text-sm">
                  <Link
                    href={`/branch/students/${s.id}`}
                    className="font-medium text-[#0b3d2e] underline"
                  >
                    {s.full_name}
                  </Link>
                  <p className="text-[#5a6f65]">
                    {s.admission_no} · {s.status} · {s.guardian_phone}
                  </p>
                </div>
                {s.status === "active" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-800"
                    pending={pending && pendingId === s.id}
                    pendingLabel="Removing…"
                    disabled={pending}
                    onClick={() =>
                      runDelete(
                        s.id,
                        `Mark ${s.full_name} as Left?`,
                        () => adminDeleteStudentAction(s.id),
                      )
                    }
                  >
                    Mark Left
                  </Button>
                ) : (
                  <span className="text-xs text-[#5a6f65]">Already {s.status}</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {tab === "dues" ? (
        <Card>
          <CardHeader>
            <CardTitle>Fee dues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredDues.map((d) => (
              <div
                key={d.id}
                className="flex flex-col gap-2 rounded-lg border border-[#0b3d2e]/10 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="text-sm">
                  <p className="font-medium">
                    {d.student_name} · {d.due_month}/{d.due_year}
                  </p>
                  <p className="text-[#5a6f65]">
                    {d.admission_no} · {d.status} · due{" "}
                    {formatMoney(d.total_due - d.amount_paid)}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-red-300 text-red-800"
                  pending={pending && pendingId === d.id}
                  pendingLabel="Deleting…"
                  disabled={pending}
                  onClick={() =>
                    runDelete(d.id, `Delete this fee due row?`, () =>
                      adminDeleteFeeDueAction(d.id),
                    )
                  }
                >
                  Delete
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {tab === "attendance" ? (
        <Card>
          <CardHeader>
            <CardTitle>Attendance sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {attendanceSessions.map((s) => (
              <div
                key={s.id}
                className="flex flex-col gap-2 rounded-lg border border-[#0b3d2e]/10 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="text-sm">
                  <p className="font-medium">{s.class_name || "Class"}</p>
                  <p className="text-[#5a6f65]">{formatDate(s.session_date)}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-red-300 text-red-800"
                  pending={pending && pendingId === s.id}
                  pendingLabel="Deleting…"
                  disabled={pending}
                  onClick={() =>
                    runDelete(s.id, "Delete this attendance session?", () =>
                      adminDeleteAttendanceSessionAction(s.id),
                    )
                  }
                >
                  Delete
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {tab === "progress" ? (
        <Card>
          <CardHeader>
            <CardTitle>Progress logs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {progressLogs.map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-2 rounded-lg border border-[#0b3d2e]/10 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="text-sm">
                  <p className="font-medium">
                    {p.student_name} · {p.stream}
                  </p>
                  <p className="text-[#5a6f65]">
                    {p.lesson_ref || "—"} · {formatDate(p.logged_at)}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-red-300 text-red-800"
                  pending={pending && pendingId === p.id}
                  pendingLabel="Deleting…"
                  disabled={pending}
                  onClick={() =>
                    runDelete(p.id, "Delete this progress log?", () =>
                      adminDeleteProgressLogAction(p.id),
                    )
                  }
                >
                  Delete
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {tab === "classes" ? (
        <Card>
          <CardHeader>
            <CardTitle>Classes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {classes.map((c) => (
              <div
                key={c.id}
                className="flex flex-col gap-2 rounded-lg border border-[#0b3d2e]/10 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-sm font-medium">{c.name}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-red-300 text-red-800"
                  pending={pending && pendingId === c.id}
                  pendingLabel="Deleting…"
                  disabled={pending}
                  onClick={() =>
                    runDelete(c.id, `Delete class ${c.name}?`, () =>
                      adminDeleteClassAction(c.id),
                    )
                  }
                >
                  Delete
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
