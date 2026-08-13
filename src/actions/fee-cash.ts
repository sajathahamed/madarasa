"use server";

import { z } from "zod";

import { canEnterData, requireProfile } from "@/lib/auth/session";

const cashOutSchema = z.object({
  vendor_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  amount: z.coerce.number().positive(),
  reason: z.string().min(2).max(500),
  notes: z.string().max(1000).optional(),
});

/**
 * Cash on hand assumption (documented for operators):
 *   cash_on_hand =
 *     sum(approved payments where method = 'cash')
 *     − sum(fee_cash_outs)
 *     − sum(expenses where payment_method = 'cash')
 * No invented opening balance — starts from recorded cash inflows only.
 */
export async function recordFeeCashOutAction(
  input: z.infer<typeof cashOutSchema>,
) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (!canEnterData(auth.profile.role)) return { error: "Forbidden" };

    const parsed = cashOutSchema.safeParse(input);
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
      .from("fee_cash_outs")
      .insert({
        vendor_id: parsed.data.vendor_id,
        branch_id: parsed.data.branch_id,
        amount: parsed.data.amount,
        reason: parsed.data.reason.trim(),
        notes: parsed.data.notes?.trim() || null,
        cashed_out_by: auth.user.id,
      })
      .select("id, cashed_out_at")
      .single();

    if (error) return { error: error.message };
    if (!data) return { error: "Failed to record cash out" };

    return {
      ok: true as const,
      cashOutId: data.id,
      cashedOutAt: data.cashed_out_at,
    };
  } catch (err) {
    console.error("[recordFeeCashOutAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to record cash out",
    };
  }
}
