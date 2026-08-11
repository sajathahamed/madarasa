"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import {
  generateDuesAction,
  sendBulkFeeRemindersAction,
  sendFeeReminderAction,
} from "@/actions/students";
import { RecordPaymentForm } from "@/components/operations/record-payment-form";
import type { PaymentHistoryRow } from "@/components/operations/record-payment-form";
import { StudentSearchInput } from "@/components/students/student-search-input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, formatMoney, formatPendingMonths } from "@/lib/format";
import { openWhatsAppLinks } from "@/lib/open-whatsapp";
import { matchesStudentQuery } from "@/lib/student-search";

type Student = {
  id: string;
  full_name: string;
  admission_no: string;
  guardian_phone?: string | null;
};
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
  guardian_phone?: string | null;
};

type PaymentSummary = {
  outstandingTotal: number;
  unpaidCount: number;
  monthApprovedTotal: number;
  monthApprovedCount: number;
  monthPendingTotal: number;
  monthPendingCount: number;
  todayApprovedTotal: number;
  monthLabel: string;
};

type ReminderChannel = "sms" | "whatsapp";

export function FeesOfficeClient({
  students,
  dues,
  payments = [],
  canGenerate,
  canRemind,
  canRecord,
  summary,
}: {
  students: Student[];
  dues: Due[];
  payments?: PaymentHistoryRow[];
  canGenerate: boolean;
  canRemind: boolean;
  canRecord: boolean;
  summary: PaymentSummary;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [messageOk, setMessageOk] = useState(false);
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
          guardian_phone:
            d.guardian_phone ||
            students.find((s) => s.id === d.student_id)?.guardian_phone,
        },
        query,
      ),
    );
  }, [dues, query, students]);

  const showResult = (text: string, ok: boolean) => {
    setMessage(text);
    setMessageOk(ok);
    if (ok) toast.success(text);
    else toast.error(text);
  };

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

  const remindSelected = (channel: ReminderChannel) => {
    run(`bulk-${channel}`, async () => {
      const result = await sendBulkFeeRemindersAction(selected, channel);
      if (result.error) {
        showResult(result.error, false);
        return;
      }
      showResult(
        result.message ||
          `${channel === "sms" ? "SMS" : "WhatsApp"}: ${result.sent} ok, ${result.failed} failed`,
        true,
      );
      if (channel === "whatsapp") openWhatsAppLinks(result.whatsappUrls);
    });
  };

  const remindOne = (dueId: string, channel: ReminderChannel) => {
    run(`${channel}-${dueId}`, async () => {
      const result = await sendFeeReminderAction(dueId, channel);
      if (result.error) {
        showResult(result.error, false);
        return;
      }
      showResult(
        result.message ||
          (channel === "sms" ? "SMS reminder sent" : "Opening WhatsApp…"),
        true,
      );
      if (channel === "whatsapp" && result.whatsappUrl) {
        openWhatsAppLinks(result.whatsappUrl);
      }
    });
  };

  return (
    <div className="space-y-6">
      {message ? (
        <div
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm ${
            messageOk
              ? "border-emerald-300 bg-emerald-50 text-emerald-950"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {messageOk ? "✓ " : ""}
          {message}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Outstanding (open dues)</CardDescription>
            <CardTitle className="text-xl">
              {formatMoney(summary.outstandingTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-[#5a6f65]">
            {summary.unpaidCount} open due{summary.unpaidCount === 1 ? "" : "s"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approved · {summary.monthLabel}</CardDescription>
            <CardTitle className="text-xl">
              {formatMoney(summary.monthApprovedTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-[#5a6f65]">
            {summary.monthApprovedCount} payment
            {summary.monthApprovedCount === 1 ? "" : "s"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending review · {summary.monthLabel}</CardDescription>
            <CardTitle className="text-xl">
              {formatMoney(summary.monthPendingTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-[#5a6f65]">
            {summary.monthPendingCount} awaiting approval
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approved today</CardDescription>
            <CardTitle className="text-xl">
              {formatMoney(summary.todayApprovedTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-[#5a6f65]">
            Payments summary for this branch
          </CardContent>
        </Card>
      </div>

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
                if (result.error) showResult(result.error, false);
                else
                  showResult(`Generated ${result.generated ?? 0} dues`, true);
                router.refresh();
              });
            }}
          >
            Generate this month&apos;s dues
          </Button>
        ) : null}
        {canRemind ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              pending={pending && pendingAction === "bulk-sms"}
              pendingLabel="Sending SMS…"
              disabled={pending || selected.length === 0}
              onClick={() => remindSelected("sms")}
            >
              SMS remind selected ({selected.length})
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              pending={pending && pendingAction === "bulk-whatsapp"}
              pendingLabel="Opening WA…"
              disabled={pending || selected.length === 0}
              onClick={() => remindSelected("whatsapp")}
            >
              WhatsApp remind selected ({selected.length})
            </Button>
          </>
        ) : null}
      </div>

      <Card className="border-[#0b3d2e]/20 bg-[#0b3d2e]/[0.03]">
        <CardHeader className="pb-3">
          <CardTitle>Search pending payments</CardTitle>
          <CardDescription>
            Find open dues by student name, admission ID, or guardian phone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StudentSearchInput
            value={query}
            onChange={setQuery}
            placeholder="Type name, admission ID, or phone…"
            className="max-w-xl"
          />
          <p className="mt-2 text-xs text-[#5a6f65]">
            Showing {outstanding.length} of{" "}
            {dues.filter((d) => d.status !== "paid").length} pending dues
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {canRecord ? (
          <Card>
            <CardHeader>
              <CardTitle>Record payment</CardTitle>
              <CardDescription>
                Submit for admin review. You will see a clear success
                message after saving.
              </CardDescription>
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
                    status: d.status,
                  }))}
                payments={payments}
                onSuccess={(msg) => {
                  showResult(msg, true);
                  router.refresh();
                }}
                onError={(msg) => showResult(msg, false)}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Record payment</CardTitle>
              <CardDescription>
                Only data entry / vendor admin can submit new payments. You can
                still search and remind parents below.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Overdue / open dues</CardTitle>
            <CardDescription>
              Select rows, then choose SMS or WhatsApp remind.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
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
                    className="flex flex-col gap-3 rounded-lg border border-[#0b3d2e]/10 p-3"
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
                          · due {formatMoney(bal)} ·{" "}
                          <span className="font-medium text-[#0b3d2e]">
                            {formatPendingMonths(bal)}
                          </span>
                        </p>
                      </div>
                    </div>
                    {canRemind ? (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full sm:w-auto"
                          pending={
                            pending && pendingAction === `sms-${d.id}`
                          }
                          pendingLabel="SMS…"
                          disabled={pending}
                          onClick={() => remindOne(d.id, "sms")}
                        >
                          SMS
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full sm:w-auto"
                          pending={
                            pending && pendingAction === `whatsapp-${d.id}`
                          }
                          pendingLabel="WA…"
                          disabled={pending}
                          onClick={() => remindOne(d.id, "whatsapp")}
                        >
                          WhatsApp
                        </Button>
                      </div>
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

      <Card>
        <CardHeader>
          <CardTitle>Who paid (recent payments)</CardTitle>
          <CardDescription>
            Visible to Admin and Data entry — student, amount, status, and who
            recorded / paid.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-[#5a6f65]">No payments recorded yet.</p>
          ) : (
            <ul className="max-h-[420px] space-y-2 overflow-y-auto text-sm">
              {payments.slice(0, 80).map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col gap-1 rounded-lg border border-[#0b3d2e]/10 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/branch/students/${p.student_id}`}
                      className="font-medium text-[#0b3d2e] underline"
                    >
                      {p.student_name || p.student_id.slice(0, 8)}
                    </Link>
                    {p.admission_no ? (
                      <span className="text-xs text-[#5a6f65]">
                        {" "}
                        · {p.admission_no}
                      </span>
                    ) : null}
                    <p className="text-[#5a6f65]">
                      {formatMoney(p.amount)} · {p.method} ·{" "}
                      {formatDate(p.created_at)}
                    </p>
                    <p className="text-xs text-[#5a6f65]">
                      {p.paid_by_note
                        ? p.paid_by_note
                        : p.recorded_by_name
                          ? `Recorded by ${p.recorded_by_name}`
                          : "Recorder unknown"}
                    </p>
                  </div>
                  <StatusBadge value={p.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
