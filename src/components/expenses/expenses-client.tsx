"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { recordExpenseAction } from "@/actions/expenses";
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
import { expenseCategoryLabel, EXPENSE_CATEGORIES } from "@/lib/expenses";
import { formatDate, formatMoney } from "@/lib/format";
import type { ExpenseCategory, ExpensePaymentMethod } from "@/types/database";

export type ExpenseRow = {
  id: string;
  category: string;
  title: string;
  amount: number;
  expense_date: string;
  payee: string | null;
  payment_method: string;
  notes: string | null;
  created_at: string;
  created_by_name: string | null;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function ExpensesClient({
  vendorId,
  branchId,
  expenses,
  canRecord,
}: {
  vendorId: string;
  branchId: string;
  expenses: ExpenseRow[];
  canRecord: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (categoryFilter !== "all" && e.category !== categoryFilter) {
        return false;
      }
      if (fromDate && e.expense_date < fromDate) return false;
      if (toDate && e.expense_date > toDate) return false;
      return true;
    });
  }, [expenses, categoryFilter, fromDate, toDate]);

  const periodTotal = filtered.reduce((sum, e) => sum + e.amount, 0);

  if (!vendorId || !branchId) {
    return (
      <p className="text-sm text-[#5a6f65]">
        Branch-scoped role required to manage expenses here.
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {canRecord ? (
        <Card>
          <CardHeader>
            <CardTitle>Record expense</CardTitle>
            <CardDescription>
              Salaries, utilities, kitchen, maintenance, and other madarasa
              outflows.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const fd = new FormData(form);
                startTransition(async () => {
                  const result = await recordExpenseAction({
                    vendor_id: vendorId,
                    branch_id: branchId,
                    category: String(fd.get("category")) as ExpenseCategory,
                    title: String(fd.get("title") ?? ""),
                    amount: Number(fd.get("amount") ?? 0),
                    expense_date: String(fd.get("expense_date") ?? todayIsoDate()),
                    payee: String(fd.get("payee") ?? "") || undefined,
                    payment_method: String(
                      fd.get("payment_method") ?? "cash",
                    ) as ExpensePaymentMethod,
                    notes: String(fd.get("notes") ?? "") || undefined,
                  });
                  if (result.error) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Expense recorded");
                  form.reset();
                  router.refresh();
                });
              }}
            >
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="exp-title">Title / description</Label>
                <Input id="exp-title" name="title" required maxLength={200} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="exp-category">Category</Label>
                <select
                  id="exp-category"
                  name="category"
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  defaultValue="miscellaneous"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="exp-amount">Amount (LKR)</Label>
                <Input
                  id="exp-amount"
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="exp-date">Date</Label>
                <Input
                  id="exp-date"
                  name="expense_date"
                  type="date"
                  required
                  defaultValue={todayIsoDate()}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="exp-method">Paid by</Label>
                <select
                  id="exp-method"
                  name="payment_method"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  defaultValue="cash"
                >
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="exp-payee">Payee</Label>
                <Input id="exp-payee" name="payee" placeholder="Optional" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="exp-notes">Notes</Label>
                <Input id="exp-notes" name="notes" placeholder="Optional" />
              </div>
              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  className="bg-[#0b3d2e]"
                  pending={pending}
                  pendingLabel="Saving…"
                >
                  Save expense
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card className={canRecord ? undefined : "lg:col-span-2"}>
        <CardHeader>
          <CardTitle>Expense list</CardTitle>
          <CardDescription>
            Filter by category or date · period total{" "}
            <span className="font-medium text-[#0b3d2e]">
              {formatMoney(periodTotal)}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <Label htmlFor="exp-filter-cat">Category</Label>
              <select
                id="exp-filter-cat"
                className="flex h-9 min-w-[10rem] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">All</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="exp-from">From</Label>
              <Input
                id="exp-from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="exp-to">To</Label>
              <Input
                id="exp-to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>

          <ul className="max-h-[28rem] space-y-2 overflow-auto text-sm">
            {filtered.map((e) => (
              <li
                key={e.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-[#0b3d2e]/10 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[#0b3d2e]">{e.title}</p>
                  <p className="text-xs text-[#5a6f65]">
                    {formatDate(e.expense_date)} ·{" "}
                    {expenseCategoryLabel(e.category)} · {e.payment_method}
                    {e.payee ? ` · ${e.payee}` : ""}
                    {e.created_by_name ? ` · by ${e.created_by_name}` : ""}
                  </p>
                  {e.notes ? (
                    <p className="mt-0.5 text-xs text-[#5a6f65]">{e.notes}</p>
                  ) : null}
                </div>
                <p className="shrink-0 font-medium">{formatMoney(e.amount)}</p>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="text-[#5a6f65]">No expenses in this filter.</li>
            ) : null}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
