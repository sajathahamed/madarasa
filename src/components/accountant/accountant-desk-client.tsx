"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { reviewTransactionAction } from "@/actions/operations";
import {
  generateDuesAction,
  sendBulkFeeRemindersAction,
  sendFeeReminderAction,
} from "@/actions/students";
import { StudentSearchInput } from "@/components/students/student-search-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, formatMoney } from "@/lib/format";
import { openWhatsAppLinks } from "@/lib/open-whatsapp";
import { matchesStudentQuery } from "@/lib/student-search";
import type { UserRole } from "@/types/database";

type PaymentRow = {
  id: string;
  amount: number;
  status: string;
  method: string;
  student_id: string;
  student_name?: string;
  admission_no?: string;
  created_at: string;
};

type DonationRow = {
  id: string;
  amount: number;
  status: string;
  type: string;
  donor_name: string;
  created_at: string;
};

type DueRow = {
  id: string;
  student_id: string;
  student_name?: string;
  admission_no?: string;
  due_month: number;
  due_year: number;
  month_amount: number;
  carried_forward: number;
  total_due: number;
  amount_paid: number;
  status: string;
};

type ApprovedPayment = {
  id: string;
  amount: number;
  method: string;
  student_name?: string;
  created_at: string;
};

export function AccountantDeskClient({
  role,
  pendingPayments,
  pendingDonations,
  dues,
  approvedRecent,
  kpis,
}: {
  role: UserRole;
  pendingPayments: PaymentRow[];
  pendingDonations: DonationRow[];
  dues: DueRow[];
  approvedRecent: ApprovedPayment[];
  kpis: {
    pendingCount: number;
    outstandingTotal: number;
    carriedTotal: number;
    collectedMonth: number;
    unpaidStudents: number;
  };
}) {
  const router = useRouter();
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [dueQuery, setDueQuery] = useState("");
  const [paymentQuery, setPaymentQuery] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canActPayment = (status: string) =>
    (role === "accountant" && status === "pending_accountant") ||
    (role === "principal" && status === "pending_principal") ||
    role === "super_admin" ||
    role === "vendor_admin";

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

  const act = (
    kind: "payment" | "donation",
    id: string,
    decision: "approve" | "reject",
  ) => {
    run(`${kind}-${id}-${decision}`, async () => {
      const result = await reviewTransactionAction({
        kind,
        id,
        decision,
        remarks: remarks[id],
      });
      setMessage(result.error ? result.error : `Marked ${decision}`);
      if (!result.error) router.refresh();
    });
  };

  const filteredPayments = pendingPayments.filter((p) =>
    matchesStudentQuery(
      { student_name: p.student_name, admission_no: p.admission_no },
      paymentQuery,
    ),
  );

  const filteredDues = dues.filter((d) =>
    matchesStudentQuery(
      { student_name: d.student_name, admission_no: d.admission_no },
      dueQuery,
    ),
  );

  const now = new Date();
  const monthLabel = now.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      {message ? (
        <p className="rounded-lg border border-[#0b3d2e]/15 bg-white/80 px-3 py-2 text-sm">
          {message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Awaiting your review</CardDescription>
            <CardTitle className="text-3xl">{kpis.pendingCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Open balances</CardDescription>
            <CardTitle className="text-2xl">
              {formatMoney(kpis.outstandingTotal)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Carried from prior months</CardDescription>
            <CardTitle className="text-2xl">
              {formatMoney(kpis.carriedTotal)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approved this month</CardDescription>
            <CardTitle className="text-2xl">
              {formatMoney(kpis.collectedMonth)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-[#0b3d2e]/15 bg-[#f7faf8]">
        <CardHeader>
          <CardTitle className="text-lg">How monthly dues work</CardTitle>
          <CardDescription>
            On the 1st of each month (or when you click Generate), every active
            fee-paying student gets a new due for {monthLabel}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-[#5a6f65]">
          <p>
            <strong className="text-[#0b3d2e]">New month fee</strong> +{" "}
            <strong className="text-[#0b3d2e]">unpaid leftover from last month</strong>{" "}
            = this month&apos;s total due.
          </p>
          <p>
            Example: last month owed {formatMoney(2000)}, paid {formatMoney(500)}
            → {formatMoney(1500)} carries forward. If this month&apos;s fee is{" "}
            {formatMoney(3000)}, new total = {formatMoney(4500)}.
          </p>
          <p>
            {kpis.unpaidStudents} student(s) currently have an open balance.
            Fee-free students are skipped.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              className="bg-[#0b3d2e]"
              pending={pending && pendingAction === "generate"}
              pendingLabel="Generating…"
              disabled={pending}
              onClick={() => {
                run("generate", async () => {
                  const result = await generateDuesAction();
                  setMessage(
                    result.error
                      ? result.error
                      : `Created ${result.generated ?? 0} new monthly dues (existing months skipped)`,
                  );
                  if (!result.error) router.refresh();
                });
              }}
            >
              Generate this month&apos;s dues
            </Button>
            <Link
              href="/branch/fees"
              className="inline-flex h-9 items-center rounded-lg border border-[#0b3d2e]/20 px-3 text-sm"
            >
              Record a payment
            </Link>
            <Link
              href="/branch/reports"
              className="inline-flex h-9 items-center rounded-lg border border-[#0b3d2e]/20 px-3 text-sm"
            >
              Collection report
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Payment approval queue</CardTitle>
            <CardDescription>
              Accountant review → Principal → ledger + WhatsApp confirm.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <StudentSearchInput
              value={paymentQuery}
              onChange={setPaymentQuery}
              placeholder="Search payment by student name or ID…"
              className="max-w-none"
            />
            {filteredPayments.length === 0 ? (
              <p className="text-sm text-[#5a6f65]">
                {pendingPayments.length === 0
                  ? "No payments waiting."
                  : "No payments match your search."}
              </p>
            ) : (
              filteredPayments.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-[#0b3d2e]/10 bg-white/70 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link
                        href={`/branch/students/${p.student_id}`}
                        className="font-medium text-[#0b3d2e] underline"
                      >
                        {p.student_name || p.student_id.slice(0, 8)}
                      </Link>
                      <p className="text-xs text-[#5a6f65]">
                        {p.admission_no} · {formatDate(p.created_at)} ·{" "}
                        {p.method.replaceAll("_", " ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-medium">
                        {formatMoney(p.amount)}
                      </p>
                      <StatusBadge value={p.status} />
                    </div>
                  </div>
                  <Input
                    className="mt-3"
                    placeholder="Accountant remarks"
                    value={remarks[p.id] ?? ""}
                    onChange={(e) =>
                      setRemarks((prev) => ({
                        ...prev,
                        [p.id]: e.target.value,
                      }))
                    }
                  />
                  {canActPayment(p.status) ? (
                    <div className="mt-3 flex gap-2">
                      <Button
                        type="button"
                        pending={
                          pending && pendingAction === `payment-${p.id}-approve`
                        }
                        pendingLabel="Approving…"
                        disabled={pending}
                        className="bg-[#0b3d2e]"
                        onClick={() => act("payment", p.id, "approve")}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        pending={
                          pending && pendingAction === `payment-${p.id}-reject`
                        }
                        pendingLabel="Rejecting…"
                        disabled={pending}
                        onClick={() => act("payment", p.id, "reject")}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-[#5a6f65]">
                      Waiting for the next role in the approval chain.
                    </p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Donation approval queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingDonations.length === 0 ? (
              <p className="text-sm text-[#5a6f65]">No donations waiting.</p>
            ) : (
              pendingDonations.map((d) => (
                <div
                  key={d.id}
                  className="rounded-xl border border-[#0b3d2e]/10 bg-white/70 p-4"
                >
                  <div className="flex justify-between gap-2">
                    <div>
                      <p className="font-medium">{d.donor_name}</p>
                      <p className="text-xs text-[#5a6f65]">
                        {formatDate(d.created_at)} · {d.type.replaceAll("_", " ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-medium">
                        {formatMoney(d.amount)}
                      </p>
                      <StatusBadge value={d.status} />
                    </div>
                  </div>
                  <Input
                    className="mt-3"
                    placeholder="Remarks"
                    value={remarks[d.id] ?? ""}
                    onChange={(e) =>
                      setRemarks((prev) => ({
                        ...prev,
                        [d.id]: e.target.value,
                      }))
                    }
                  />
                  {canActPayment(d.status) ? (
                    <div className="mt-3 flex gap-2">
                      <Button
                        type="button"
                        pending={
                          pending &&
                          pendingAction === `donation-${d.id}-approve`
                        }
                        pendingLabel="Approving…"
                        disabled={pending}
                        className="bg-[#0b3d2e]"
                        onClick={() => act("donation", d.id, "approve")}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        pending={
                          pending &&
                          pendingAction === `donation-${d.id}-reject`
                        }
                        pendingLabel="Rejecting…"
                        disabled={pending}
                        onClick={() => act("donation", d.id, "reject")}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Open student dues</CardTitle>
            <CardDescription>
              Month fee + carried forward − paid. Select rows to WhatsApp remind.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            pending={pending && pendingAction === "bulk-remind"}
            pendingLabel="Sending…"
            disabled={pending || selected.length === 0}
            onClick={() => {
              run("bulk-remind", async () => {
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
        </CardHeader>
        <CardContent className="space-y-3">
          <StudentSearchInput
            value={dueQuery}
            onChange={setDueQuery}
            placeholder="Search dues by student name or ID…"
            className="max-w-none"
          />
          <p className="text-xs text-[#5a6f65] md:hidden">
            Swipe sideways to see all columns
          </p>
          <div className="-mx-4 overflow-x-auto overscroll-x-contain px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="border-b border-[#0b3d2e]/10 text-[#5a6f65]">
                <tr>
                  <th className="px-2 py-2"></th>
                  <th className="px-2 py-2 font-medium">Student</th>
                  <th className="px-2 py-2 font-medium">Period</th>
                  <th className="px-2 py-2 font-medium">Month fee</th>
                  <th className="px-2 py-2 font-medium">Carried</th>
                  <th className="px-2 py-2 font-medium">Paid</th>
                  <th className="px-2 py-2 font-medium">Balance</th>
                  <th className="px-2 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filteredDues.map((d) => {
                  const bal = d.total_due - d.amount_paid;
                  return (
                    <tr key={d.id} className="border-b border-[#0b3d2e]/5">
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selected.includes(d.id)}
                          onChange={(e) =>
                            setSelected((prev) =>
                              e.target.checked
                                ? [...prev, d.id]
                                : prev.filter((x) => x !== d.id),
                            )
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Link
                          href={`/branch/students/${d.student_id}`}
                          className="underline"
                        >
                          {d.student_name || d.student_id.slice(0, 8)}
                        </Link>
                        <p className="text-xs text-[#5a6f65]">
                          {d.admission_no}
                        </p>
                      </td>
                      <td className="px-2 py-2">
                        {d.due_month}/{d.due_year}
                        <div className="mt-1">
                          <StatusBadge value={d.status} />
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        {formatMoney(d.month_amount)}
                      </td>
                      <td className="px-2 py-2 text-amber-800">
                        {formatMoney(d.carried_forward)}
                      </td>
                      <td className="px-2 py-2">
                        {formatMoney(d.amount_paid)}
                      </td>
                      <td className="px-2 py-2 font-medium">
                        {formatMoney(bal)}
                      </td>
                      <td className="px-2 py-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          pending={pending && pendingAction === `remind-${d.id}`}
                          pendingLabel="…"
                          disabled={pending}
                          onClick={() => {
                            run(`remind-${d.id}`, async () => {
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
                              openWhatsAppLinks(result.whatsappUrl);
                            });
                          }}
                        >
                          Remind
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {filteredDues.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-2 py-6 text-[#5a6f65]">
                      {dues.length === 0
                        ? "No open dues. Generate this month&apos;s dues if the cron has not run yet."
                        : "No dues match your search."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recently approved payments</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {approvedRecent.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#0b3d2e]/10 px-3 py-2"
              >
                <span>
                  {p.student_name || "Student"} · {formatDate(p.created_at)} ·{" "}
                  {p.method.replaceAll("_", " ")}
                </span>
                <span className="flex items-center gap-3">
                  {formatMoney(p.amount)}
                  <Link
                    href={`/branch/fees/receipt/${p.id}`}
                    className="underline"
                  >
                    Receipt
                  </Link>
                </span>
              </li>
            ))}
            {approvedRecent.length === 0 ? (
              <li className="text-[#5a6f65]">No approved payments yet.</li>
            ) : null}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
