"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { recordFeeCashOutAction } from "@/actions/fee-cash";
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
import { formatDate, formatMoney } from "@/lib/format";

export type CashOutRow = {
  id: string;
  amount: number;
  reason: string;
  notes: string | null;
  cashed_out_at: string;
  cashed_out_by_name: string | null;
};

export type CashDrawerSummary = {
  /** Approved fee payments collected today (all methods). */
  todayCollectionsTotal: number;
  /** Approved cash-method fee payments (all time, scoped). */
  approvedCashTotal: number;
  /** Sum of fee_cash_outs (all time, scoped). */
  cashOutsTotal: number;
  /** Sum of cash-method expenses (all time, scoped). */
  cashExpensesTotal: number;
  /**
   * Cash on hand ≈ approved cash payments − cash outs − cash expenses.
   * No invented opening balance.
   */
  cashOnHand: number;
};

export function FeeCashDrawer({
  vendorId,
  branchId,
  canRecord,
  summary,
  history,
}: {
  vendorId: string;
  branchId: string;
  canRecord: boolean;
  summary: CashDrawerSummary;
  history: CashOutRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  if (!vendorId || !branchId) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Fee cash drawer</CardTitle>
          <CardDescription>
            Today&apos;s collections and cash taken out of the till. Cash on
            hand = approved cash fees − cash outs − cash expenses (no opening
            balance invented).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-[#0b3d2e]/10 px-3 py-2">
              <p className="text-xs text-[#5a6f65]">Today collected (approved)</p>
              <p className="text-lg font-medium text-[#0b3d2e]">
                {formatMoney(summary.todayCollectionsTotal)}
              </p>
            </div>
            <div className="rounded-lg border border-[#0b3d2e]/10 px-3 py-2">
              <p className="text-xs text-[#5a6f65]">Cash on hand</p>
              <p className="text-lg font-medium text-[#0b3d2e]">
                {formatMoney(summary.cashOnHand)}
              </p>
            </div>
            <div className="rounded-lg border border-[#0b3d2e]/10 px-3 py-2">
              <p className="text-xs text-[#5a6f65]">Cash fees (all time)</p>
              <p className="font-medium">{formatMoney(summary.approvedCashTotal)}</p>
            </div>
            <div className="rounded-lg border border-[#0b3d2e]/10 px-3 py-2">
              <p className="text-xs text-[#5a6f65]">Cashed out (all time)</p>
              <p className="font-medium">{formatMoney(summary.cashOutsTotal)}</p>
            </div>
          </div>

          {canRecord ? (
            <form
              className="grid gap-3 border-t border-[#0b3d2e]/10 pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                const amt = Number(amount);
                if (!Number.isFinite(amt) || amt <= 0) {
                  toast.error("Enter a valid amount");
                  return;
                }
                if (!reason.trim()) {
                  toast.error("Reason is required");
                  return;
                }
                startTransition(async () => {
                  const result = await recordFeeCashOutAction({
                    vendor_id: vendorId,
                    branch_id: branchId,
                    amount: amt,
                    reason: reason.trim(),
                    notes: notes.trim() || undefined,
                  });
                  if (result.error) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success(`Cashed out ${formatMoney(amt)}`);
                  setAmount("");
                  setReason("");
                  setNotes("");
                  router.refresh();
                });
              }}
            >
              <p className="text-sm font-medium text-[#0b3d2e]">Cash out</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="cash-out-amount">Amount (LKR)</Label>
                  <Input
                    id="cash-out-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={pending}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cash-out-reason">Why / reason</Label>
                  <Input
                    id="cash-out-reason"
                    required
                    maxLength={500}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Bank deposit, petty cash"
                    disabled={pending}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="cash-out-notes">Notes (optional)</Label>
                  <Input
                    id="cash-out-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={pending}
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="bg-[#0b3d2e]"
                pending={pending}
                pendingLabel="Saving…"
              >
                Record cash out
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cash-out history</CardTitle>
          <CardDescription>
            Who took cash out, why, and when.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="max-h-[28rem] space-y-2 overflow-auto text-sm">
            {history.map((row) => (
              <li
                key={row.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-[#0b3d2e]/10 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[#0b3d2e]">{row.reason}</p>
                  <p className="text-xs text-[#5a6f65]">
                    {formatDate(row.cashed_out_at)} ·{" "}
                    {row.cashed_out_by_name || "Unknown"}
                  </p>
                  {row.notes ? (
                    <p className="mt-0.5 text-xs text-[#5a6f65]">{row.notes}</p>
                  ) : null}
                </div>
                <p className="shrink-0 font-medium">{formatMoney(row.amount)}</p>
              </li>
            ))}
            {history.length === 0 ? (
              <li className="text-[#5a6f65]">No cash-outs yet.</li>
            ) : null}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
