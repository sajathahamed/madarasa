"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  generateDuesAction,
  sendBulkFeeRemindersAction,
  sendFeeReminderAction,
} from "@/actions/students";
import { RecordPaymentForm } from "@/components/operations/record-payment-form";
import { StudentSearchInput } from "@/components/students/student-search-input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { openWhatsAppLinks } from "@/lib/open-whatsapp";
import { matchesStudentQuery } from "@/lib/student-search";

type Student = { id: string; full_name: string; admission_no: string };
type Due = {
  id: string;
  student_id: string;
  total_due: number;
  amount_paid: number;
  due_month: number;
  due_year: number;
  status: string;
  month_amount?: number;
  carried_forward?: number;
  student_name?: string;
  admission_no?: string;
};

export function FeesOfficeClient({
  students,
  dues,
  canGenerate,
  canRemind,
}: {
  students: Student[];
  dues: Due[];
  canGenerate: boolean;
  canRemind: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const outstanding = useMemo(() => {
    const open = dues.filter((d) => d.status !== "paid");
    return open.filter((d) =>
      matchesStudentQuery(
        {
          student_name: d.student_name,
          admission_no:
            d.admission_no ||
            students.find((s) => s.id === d.student_id)?.admission_no,
          full_name: students.find((s) => s.id === d.student_id)?.full_name,
        },
        query,
      ),
    );
  }, [dues, query, students]);

  const run = (key: string, fn: () => Promise<void>) => {
    setPendingAction(key);
    startTransition(async () => {
      try {
        await fn();
      } finally {
        setPendingAction(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm">{message}</p> : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {canGenerate ? (
          <Button
            type="button"
            className="w-full bg-[#0b3d2e] sm:w-auto"
            pending={pending && pendingAction === "generate"}
            pendingLabel="Generating…"
            disabled={pending}
            onClick={() => {
              run("generate", async () => {
                const result = await generateDuesAction();
                setMessage(
                  result.error
                    ? result.error
                    : `Generated ${result.generated ?? 0} dues`,
                );
                router.refresh();
              });
            }}
          >
            Generate this month&apos;s dues
          </Button>
        ) : null}
        {canRemind ? (
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            pending={pending && pendingAction === "bulk"}
            pendingLabel="Sending…"
            disabled={pending || selected.length === 0}
            onClick={() => {
              run("bulk", async () => {
                const result = await sendBulkFeeRemindersAction(selected);
                if (result.error) {
                  setMessage(result.error);
                  return;
                }
                setMessage(
                  result.message ||
                    `Reminders: ${result.sent} ok, ${result.failed} failed`,
                );
                openWhatsAppLinks(result.whatsappUrls);
              });
            }}
          >
            SMS + WhatsApp remind selected ({selected.length})
          </Button>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Record payment</CardTitle>
            <CardDescription>Starts accountant review.</CardDescription>
          </CardHeader>
          <CardContent>
            <RecordPaymentForm
              students={students}
              dues={dues
                .filter((d) => d.status !== "paid")
                .map((d) => ({
                  id: d.id,
                  student_id: d.student_id,
                  total_due: d.total_due,
                  amount_paid: d.amount_paid,
                  due_month: d.due_month,
                  due_year: d.due_year,
                }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Overdue / open dues</CardTitle>
            <CardDescription>Select rows to bulk-remind parents.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <StudentSearchInput value={query} onChange={setQuery} />
            <ul className="max-h-[480px] space-y-2 overflow-y-auto text-sm">
              {outstanding.map((d) => {
                const bal = d.total_due - d.amount_paid;
                const checked = selected.includes(d.id);
                const admission =
                  d.admission_no ||
                  students.find((s) => s.id === d.student_id)?.admission_no;
                return (
                  <li
                    key={d.id}
                    className="flex flex-col gap-3 rounded-lg border border-[#0b3d2e]/10 p-3 sm:flex-row sm:items-start sm:gap-2"
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 shrink-0"
                        checked={checked}
                        onChange={(e) => {
                          setSelected((prev) =>
                            e.target.checked
                              ? [...prev, d.id]
                              : prev.filter((x) => x !== d.id),
                          );
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/branch/students/${d.student_id}`}
                          className="font-medium break-words text-[#0b3d2e] underline"
                        >
                          {d.student_name || d.student_id.slice(0, 8)}
                        </Link>
                        {admission ? (
                          <p className="text-xs text-[#5a6f65]">{admission}</p>
                        ) : null}
                        <p className="text-[#5a6f65]">
                          {d.due_month}/{d.due_year} · {d.status}
                          {d.carried_forward
                            ? ` · carried ${formatMoney(d.carried_forward)}`
                            : ""}{" "}
                          · due {formatMoney(bal)}
                        </p>
                      </div>
                    </div>
                    {canRemind ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full shrink-0 sm:w-auto"
                        pending={pending && pendingAction === d.id}
                        pendingLabel="…"
                        disabled={pending}
                        onClick={() => {
                          run(d.id, async () => {
                            const result = await sendFeeReminderAction(d.id);
                            if (result.error) {
                              setMessage(result.error);
                              return;
                            }
                            setMessage(
                              result.message ||
                                (result.smsOk
                                  ? "SMS sent · Opening WhatsApp…"
                                  : "Opening WhatsApp…"),
                            );
                            if (result.whatsappUrl) {
                              openWhatsAppLinks(result.whatsappUrl);
                            }
                          });
                        }}
                      >
                        Remind
                      </Button>
                    ) : null}
                  </li>
                );
              })}
              {outstanding.length === 0 ? (
                <li className="text-[#5a6f65]">
                  {dues.some((d) => d.status !== "paid")
                    ? "No dues match your search."
                    : "No open dues."}
                </li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
