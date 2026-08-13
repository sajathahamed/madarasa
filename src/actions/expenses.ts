"use server";

import { z } from "zod";

import { canEnterData, requireProfile } from "@/lib/auth/session";
import type { ExpenseCategory, ExpensePaymentMethod } from "@/types/database";

const expenseSchema = z.object({
  vendor_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  category: z.enum([
    "salary",
    "utilities",
    "food_kitchen",
    "maintenance",
    "books_stationery",
    "transport",
    "charity_zakat",
    "miscellaneous",
  ]),
  title: z.string().min(2).max(200),
  amount: z.coerce.number().positive(),
  expense_date: z.string().min(8),
  payee: z.string().max(200).optional(),
  payment_method: z.enum(["cash", "bank"]).default("cash"),
  notes: z.string().max(1000).optional(),
});

export async function recordExpenseAction(
  input: z.infer<typeof expenseSchema>,
) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (!canEnterData(auth.profile.role)) return { error: "Forbidden" };

    const parsed = expenseSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues.map((i) => i.message).join("; ") };
    }

    if (
      auth.profile.vendor_id &&
      parsed.data.vendor_id !== auth.profile.vendor_id
    ) {
      return { error: "Vendor mismatch" };
    }
    if (
      auth.profile.branch_id &&
      parsed.data.branch_id !== auth.profile.branch_id
    ) {
      return { error: "Branch mismatch" };
    }

    const { data, error } = await auth.supabase
      .from("expenses")
      .insert({
        vendor_id: parsed.data.vendor_id,
        branch_id: parsed.data.branch_id,
        category: parsed.data.category as ExpenseCategory,
        title: parsed.data.title.trim(),
        amount: parsed.data.amount,
        expense_date: parsed.data.expense_date.slice(0, 10),
        payee: parsed.data.payee?.trim() || null,
        payment_method: parsed.data.payment_method as ExpensePaymentMethod,
        notes: parsed.data.notes?.trim() || null,
        created_by: auth.user.id,
      })
      .select("id")
      .single();

    if (error) return { error: error.message };
    if (!data) return { error: "Failed to record expense" };

    return { ok: true as const, expenseId: data.id };
  } catch (err) {
    console.error("[recordExpenseAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to record expense",
    };
  }
}

export async function deleteExpenseAction(expenseId: string) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (!["super_admin", "vendor_admin"].includes(auth.profile.role)) {
      return { error: "Forbidden" };
    }

    const { error } = await auth.supabase
      .from("expenses")
      .delete()
      .eq("id", expenseId);

    if (error) return { error: error.message };
    return { ok: true as const };
  } catch (err) {
    console.error("[deleteExpenseAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to delete expense",
    };
  }
}
