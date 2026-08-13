"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  recordPaymentAction,
  sendPaymentConfirmSmsAction,
} from "@/actions/operations";
import { StudentSearchSelect } from "@/components/students/student-search-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, formatMoney, formatPendingMonths } from "@/lib/format";
import { paymentConfirmSmsMessage } from "@/lib/sms/templates";

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
  status?: string;
};

export type PaymentHistoryRow = {
  id: string;
  student_id: string;
  amount: number;
  status: string;
  method: string;
  created_at: string;
  recorded_by_name?: string | null;
  paid_by_note?: string | null;
  student_name?: string;
  admission_no?: string;
};

type SmsOffer = {
  studentId: string;
  studentName: string;
  amount: number;
  phone: string;
  defaultMessage: string;
};

export function RecordPaymentForm({
  students,
  dues,
  payments = [],
  onSuccess,
  onError,
}: {
  students: Student[];
  dues: Due[];
  payments?: PaymentHistoryRow[];
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}) {
  const [studentId, setStudentId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [smsOffer, setSmsOffer] = useState<SmsOffer | null>(null);
  const [smsText, setSmsText] = useState("");
  const [smsFeedback, setSmsFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [smsPending, startSmsTransition] = useTransition();

  const studentDues = useMemo(
    () => dues.filter((d) => d.student_id === studentId),
    [dues, studentId],
  );

  const studentPayments = useMemo(
    () =>
      payments
        .filter((p) => p.student_id === studentId)
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
    [payments, studentId],
  );

  const totals = useMemo(() => {
    const totalDue = studentDues.reduce((s, d) => s + Number(d.total_due), 0);
    const paidOnDues = studentDues.reduce(
      (s, d) => s + Number(d.amount_paid),
      0,
    );
    const remaining = Math.max(0, totalDue - paidOnDues);
    const approvedPaid = studentPayments
      .filter((p) => p.status === "approved")
      .reduce((s, p) => s + Number(p.amount), 0);
    return { totalDue, paidOnDues, remaining, approvedPaid };
  }, [studentDues, studentPayments]);

  const studentName =
    students.find((s) => s.id === studentId)?.full_name ?? "student";

  return (
    <div className="space-y-3">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(form);
          const amount = Number(fd.get("amount") ?? 0);
          const selectedId = studentId;
          const selectedName = studentName;
          startTransition(async () => {
            setSmsOffer(null);
            setSmsFeedback(null);
            const result = await recordPaymentAction({
              student_id: selectedId,
              fee_due_id: String(fd.get("fee_due_id") ?? "") || undefined,
              amount,
              method: String(fd.get("method") ?? "cash") as
                | "cash"
                | "bank_transfer"
                | "card"
                | "online",
              bank_reference:
                String(fd.get("bank_reference") ?? "") || undefined,
            });
            if (result.error) {
              setOk(false);
              setMessage(result.error);
              if (onError) onError(result.error);
              else toast.error(result.error);
              return;
            }
            const success = `Payment applied — ${formatMoney(amount)} for ${selectedName}. Balance reduced.`;
            setOk(true);
            setMessage(success);
            if (onSuccess) onSuccess(success);
            else toast.success(success);

            const phone =
              result.guardianPhone ||
              students.find((s) => s.id === selectedId)?.guardian_phone ||
              "";
            if (phone) {
              const defaultMessage = paymentConfirmSmsMessage({
                studentName: selectedName,
                amountText: Number(amount).toLocaleString("en-LK", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }),
              });
              setSmsOffer({
                studentId: selectedId,
                studentName: selectedName,
                amount,
                phone,
                defaultMessage,
              });
              setSmsText(defaultMessage);
            } else {
              setSmsFeedback(
                "No guardian phone on this student — SMS skipped.",
              );
            }

            form.reset();
            setStudentId("");
          });
        }}
      >
        <StudentSearchSelect
          students={students}
          value={studentId}
          onChange={setStudentId}
          required
        />

        {studentId ? (
          <div className="space-y-3 rounded-xl border border-[#0b3d2e]/15 bg-[#0b3d2e]/[0.03] p-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-[#0b3d2e]/10 bg-white/80 px-3 py-2">
                <p className="text-xs text-[#5a6f65]">Total due</p>
                <p className="font-medium text-[#0b3d2e]">
                  {formatMoney(totals.totalDue)}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2">
                <p className="text-xs text-emerald-800">Already paid</p>
                <p className="font-medium text-emerald-950">
                  {formatMoney(totals.paidOnDues)}
                </p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2">
                <p className="text-xs text-amber-900">Remaining</p>
                <p className="font-medium text-amber-950">
                  {formatMoney(totals.remaining)}
                </p>
                <p className="text-[11px] text-amber-800/80">
                  {formatPendingMonths(totals.remaining)}
                </p>
              </div>
            </div>
            <p className="text-xs text-[#5a6f65]">
              Remaining = total due − paid on open dues (
              {formatMoney(totals.totalDue)} − {formatMoney(totals.paidOnDues)}
              ).
            </p>

            {studentDues.length > 0 ? (
              <div>
                <p className="mb-1 text-xs font-medium text-[#0b3d2e]">
                  Open dues
                </p>
                <ul className="max-h-28 space-y-1 overflow-y-auto text-xs text-[#5a6f65]">
                  {studentDues.map((d) => {
                    const bal = Number(d.total_due) - Number(d.amount_paid);
                    return (
                      <li key={d.id}>
                        {d.due_month}/{d.due_year}: due{" "}
                        {formatMoney(d.total_due)} · paid{" "}
                        {formatMoney(d.amount_paid)} · remaining{" "}
                        {formatMoney(bal)}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-[#5a6f65]">
                No open dues for this student.
              </p>
            )}

            <div>
              <p className="mb-1 text-xs font-medium text-[#0b3d2e]">
                Previous payments
              </p>
              {studentPayments.length === 0 ? (
                <p className="text-xs text-[#5a6f65]">No payment history yet.</p>
              ) : (
                <ul className="max-h-40 space-y-1.5 overflow-y-auto text-xs">
                  {studentPayments.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#0b3d2e]/10 bg-white/70 px-2 py-1.5"
                    >
                      <span>
                        <span className="font-medium text-[#0b3d2e]">
                          {formatMoney(p.amount)}
                        </span>
                        <span className="text-[#5a6f65]">
                          {" "}
                          · {formatDate(p.created_at)} · {p.method}
                        </span>
                        <span className="mt-0.5 block text-[#5a6f65]">
                          {p.paid_by_note
                            ? p.paid_by_note
                            : p.recorded_by_name
                              ? `Recorded by ${p.recorded_by_name}`
                              : "Recorder unknown"}
                        </span>
                      </span>
                      <StatusBadge value={p.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}

        <div className="space-y-1">
          <Label htmlFor="fee_due_id">Fee due (optional)</Label>
          <select
            id="fee_due_id"
            name="fee_due_id"
            className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm md:h-9"
          >
            <option value="">None</option>
            {studentDues.map((d) => {
              const bal = Number(d.total_due) - Number(d.amount_paid);
              return (
                <option key={d.id} value={d.id}>
                  {d.due_month}/{d.due_year} · balance {formatMoney(bal)} (
                  {formatPendingMonths(bal)})
                </option>
              );
            })}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            key={studentId || "none"}
            defaultValue={
              studentId && totals.remaining > 0
                ? String(totals.remaining)
                : undefined
            }
            placeholder={
              studentId
                ? `Remaining ${formatMoney(totals.remaining)}`
                : "Enter amount"
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="method">Method</Label>
          <select
            id="method"
            name="method"
            className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm md:h-9"
            defaultValue="cash"
          >
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="card">Card</option>
            <option value="online">Online</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="bank_reference">Bank reference</Label>
          <Input id="bank_reference" name="bank_reference" />
        </div>
        {message ? (
          <p
            role="status"
            className={`rounded-lg border px-3 py-2 text-sm ${
              ok
                ? "border-emerald-300 bg-emerald-50 font-medium text-emerald-950"
                : "border-red-200 bg-red-50 text-red-900"
            }`}
          >
            {ok ? "✓ " : ""}
            {message}
          </p>
        ) : null}
        <Button
          type="submit"
          pending={pending}
          pendingLabel="Saving…"
          className="bg-[#0b3d2e]"
        >
          Submit payment
        </Button>
      </form>

      {smsOffer ? (
        <div className="space-y-3 rounded-xl border border-sky-300 bg-sky-50 p-3">
          <div>
            <p className="font-medium text-sky-950">Send SMS confirmation?</p>
            <p className="text-xs text-sky-900/80">
              Guardian: {smsOffer.phone} · Mask: Upview Tech
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="payment_sms_msg">Message (EN + TA)</Label>
            <textarea
              id="payment_sms_msg"
              value={smsText}
              onChange={(e) => setSmsText(e.target.value)}
              rows={7}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="bg-[#0b3d2e]"
              pending={smsPending}
              pendingLabel="Sending SMS…"
              onClick={() => {
                startSmsTransition(async () => {
                  const result = await sendPaymentConfirmSmsAction({
                    studentId: smsOffer.studentId,
                    amount: smsOffer.amount,
                    message: smsText,
                  });
                  if (result.error) {
                    setSmsFeedback(result.error);
                    toast.error(result.error);
                    return;
                  }
                  const msg = result.message || "SMS sent";
                  setSmsFeedback(msg);
                  toast.success(msg);
                  setSmsOffer(null);
                });
              }}
            >
              Send SMS
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={smsPending}
              onClick={() => {
                setSmsOffer(null);
                setSmsFeedback("SMS skipped.");
              }}
            >
              Skip SMS
            </Button>
          </div>
        </div>
      ) : null}

      {smsFeedback ? (
        <p className="text-sm text-[#0b3d2e]">{smsFeedback}</p>
      ) : null}
    </div>
  );
}
