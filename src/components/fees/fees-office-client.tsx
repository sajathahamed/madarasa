"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  generateDuesAction,
  sendBulkFeeRemindersAction,
  sendFeeReminderAction,
} from "@/actions/students";
import { RecordPaymentForm } from "@/components/operations/record-payment-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoney } from "@/lib/format";

type Student = { id: string; full_name: string; admission_no: string };
type Due = {
  id: string;
  student_id: string;
  total_due: number;
  amount_paid: number;
  due_month: number;
  due_year: number;
  status: string;
  student_name?: string;
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
  const [pending, startTransition] = useTransition();

  const outstanding = dues.filter((d) => d.status !== "paid");

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm">{message}</p> : null}

      <div className="flex flex-wrap gap-2">
        {canGenerate ? (
          <Button
            type="button"
            className="bg-[#0b3d2e]"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
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
            disabled={pending || selected.length === 0}
            onClick={() => {
              startTransition(async () => {
                const result = await sendBulkFeeRemindersAction(selected);
                setMessage(
                  result.error
                    ? result.error
                    : `Reminders sent ${result.sent}, failed ${result.failed}`,
                );
              });
            }}
          >
            WhatsApp remind selected ({selected.length})
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
              dues={outstanding.map((d) => ({
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
          <CardContent>
            <ul className="max-h-[480px] space-y-2 overflow-y-auto text-sm">
              {outstanding.map((d) => {
                const bal = d.total_due - d.amount_paid;
                const checked = selected.includes(d.id);
                return (
                  <li
                    key={d.id}
                    className="flex items-start gap-2 rounded-lg border border-[#0b3d2e]/10 p-3"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={checked}
                      onChange={(e) => {
                        setSelected((prev) =>
                          e.target.checked
                            ? [...prev, d.id]
                            : prev.filter((x) => x !== d.id),
                        );
                      }}
                    />
                    <div className="flex-1">
                      <Link
                        href={`/branch/students/${d.student_id}`}
                        className="font-medium text-[#0b3d2e] underline"
                      >
                        {d.student_name || d.student_id.slice(0, 8)}
                      </Link>
                      <p className="text-[#5a6f65]">
                        {d.due_month}/{d.due_year} · {d.status} · due{" "}
                        {formatMoney(bal)}
                      </p>
                    </div>
                    {canRemind ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            const result = await sendFeeReminderAction(d.id);
                            setMessage(
                              result.error ? result.error : "Reminder sent",
                            );
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
                <li className="text-[#5a6f65]">No open dues.</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
