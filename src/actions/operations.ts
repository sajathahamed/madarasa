"use server";

import { z } from "zod";

import { requireProfile } from "@/lib/auth/session";
import type { ApprovalStatus, PaymentMethod, DonationType } from "@/types/database";

const studentSchema = z.object({
  vendor_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  admission_no: z.string().min(1),
  full_name: z.string().min(2),
  dob: z.string().optional(),
  gender: z.string().optional(),
  guardian_name: z.string().min(2),
  guardian_phone: z.string().min(8),
  address: z.string().optional(),
  monthly_amount: z.coerce.number().min(0),
  is_free: z.boolean().optional().default(false),
  discount_percent: z.coerce.number().min(0).max(100).optional().default(0),
  blood_group: z.string().optional(),
  allergies: z.string().optional(),
  medical_conditions: z.string().optional(),
  current_medications: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  notes: z.string().optional(),
});

export async function createStudentAction(input: z.infer<typeof studentSchema>) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };

    if (!["super_admin", "vendor_admin", "data_entry"].includes(auth.profile.role)) {
      return { error: "Forbidden" };
    }

    const parsed = studentSchema.safeParse(input);
    if (!parsed.success) {
      return {
        error: parsed.error.issues.map((i) => i.message).join("; "),
      };
    }

    const { data: student, error } = await auth.supabase
      .from("students")
      .insert({
        vendor_id: parsed.data.vendor_id,
        branch_id: parsed.data.branch_id,
        admission_no: parsed.data.admission_no,
        full_name: parsed.data.full_name,
        dob: parsed.data.dob || null,
        gender: parsed.data.gender || null,
        guardian_name: parsed.data.guardian_name,
        guardian_phone: parsed.data.guardian_phone,
        address: parsed.data.address || null,
        created_by: auth.user.id,
      })
      .select()
      .single();

    if (error || !student) {
      return { error: error?.message ?? "Student create failed" };
    }

    const [{ error: healthError }, { error: planError }] = await Promise.all([
      auth.supabase.from("student_health_info").insert({
        student_id: student.id,
        blood_group: parsed.data.blood_group || null,
        allergies: parsed.data.allergies || null,
        medical_conditions: parsed.data.medical_conditions || null,
        current_medications: parsed.data.current_medications || null,
        emergency_contact_name: parsed.data.emergency_contact_name || null,
        emergency_contact_phone: parsed.data.emergency_contact_phone || null,
        notes: parsed.data.notes || null,
      }),
      auth.supabase.from("student_fee_plans").insert({
        student_id: student.id,
        monthly_amount: parsed.data.is_free ? 0 : parsed.data.monthly_amount,
        is_free: parsed.data.is_free,
        discount_percent: parsed.data.discount_percent,
        is_current: true,
      }),
    ]);

    if (healthError || planError) {
      await auth.supabase.from("students").delete().eq("id", student.id);
      return {
        error:
          healthError?.message ?? planError?.message ?? "Related insert failed",
      };
    }

    return { data: student };
  } catch (err) {
    console.error("[createStudentAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to create student",
    };
  }
}

const paymentSchema = z.object({
  student_id: z.string().uuid(),
  fee_due_id: z.string().uuid().optional(),
  amount: z.coerce.number().positive(),
  method: z.enum(["cash", "bank_transfer", "card", "online"]),
  bank_reference: z.string().optional(),
});

export async function recordPaymentAction(input: z.infer<typeof paymentSchema>) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (!["super_admin", "vendor_admin", "data_entry"].includes(auth.profile.role)) {
      return { error: "Forbidden" };
    }

    const parsed = paymentSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues.map((i) => i.message).join("; ") };
    }

    const { data: student } = await auth.supabase
      .from("students")
      .select("id, vendor_id, branch_id")
      .eq("id", parsed.data.student_id)
      .maybeSingle();

    if (!student) return { error: "Student not found" };

    const { error } = await auth.supabase.from("payments").insert({
      vendor_id: student.vendor_id,
      branch_id: student.branch_id,
      student_id: student.id,
      fee_due_id: parsed.data.fee_due_id || null,
      amount: parsed.data.amount,
      method: parsed.data.method as PaymentMethod,
      bank_reference: parsed.data.bank_reference || null,
      recorded_by: auth.user.id,
      status: "pending_accountant" as ApprovalStatus,
    });

    if (error) return { error: error.message };
    return { ok: true as const };
  } catch (err) {
    console.error("[recordPaymentAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to record payment",
    };
  }
}

const donationSchema = z.object({
  vendor_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  donor_name: z.string().min(2),
  donor_phone: z.string().optional(),
  amount: z.coerce.number().positive(),
  type: z.enum(["cash", "bank_transfer"]),
  bank_reference: z.string().optional(),
});

export async function recordDonationAction(input: z.infer<typeof donationSchema>) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (!["super_admin", "vendor_admin", "data_entry"].includes(auth.profile.role)) {
      return { error: "Forbidden" };
    }

    const parsed = donationSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues.map((i) => i.message).join("; ") };
    }

    if (!parsed.data.branch_id) {
      return { error: "Select a branch before recording a donation." };
    }

    const { error } = await auth.supabase.from("donations").insert({
      vendor_id: parsed.data.vendor_id,
      branch_id: parsed.data.branch_id,
      donor_name: parsed.data.donor_name,
      donor_phone: parsed.data.donor_phone || null,
      amount: parsed.data.amount,
      type: parsed.data.type as DonationType,
      bank_reference: parsed.data.bank_reference || null,
      received_by: auth.user.id,
      status: "pending_accountant" as ApprovalStatus,
    });

    if (error) return { error: error.message };
    return { ok: true as const };
  } catch (err) {
    console.error("[recordDonationAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to record donation",
    };
  }
}

const approvalSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["payment", "donation"]),
  decision: z.enum(["approve", "reject"]),
  remarks: z.string().optional(),
});

export async function reviewTransactionAction(
  input: z.infer<typeof approvalSchema>,
) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };

    const parsed = approvalSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues.map((i) => i.message).join("; ") };
    }

    const table = parsed.data.kind === "payment" ? "payments" : "donations";
    const { data: row } = await auth.supabase
      .from(table)
      .select("*")
      .eq("id", parsed.data.id)
      .maybeSingle();

    if (!row) return { error: "Record not found" };

    const now = new Date().toISOString();
    const canActAsAccountant =
      auth.profile.role === "accountant" ||
      auth.profile.role === "vendor_admin" ||
      auth.profile.role === "super_admin";
    const canActAsPrincipal =
      auth.profile.role === "principal" ||
      auth.profile.role === "vendor_admin" ||
      auth.profile.role === "super_admin";

    if (canActAsAccountant && row.status === "pending_accountant") {
      const nextStatus: ApprovalStatus =
        parsed.data.decision === "approve" ? "pending_principal" : "rejected";
      const { error } = await auth.supabase
        .from(table)
        .update({
          status: nextStatus,
          accountant_id: auth.user.id,
          accountant_action_at: now,
          accountant_remarks: parsed.data.remarks || null,
        })
        .eq("id", parsed.data.id);
      if (error) return { error: error.message };
      return { data: { status: nextStatus } };
    }

    if (canActAsPrincipal && row.status === "pending_principal") {
      const nextStatus: ApprovalStatus =
        parsed.data.decision === "approve" ? "approved" : "rejected";
      const { error } = await auth.supabase
        .from(table)
        .update({
          status: nextStatus,
          principal_id: auth.user.id,
          principal_action_at: now,
          principal_remarks: parsed.data.remarks || null,
        })
        .eq("id", parsed.data.id);
      if (error) return { error: error.message };

      if (
        nextStatus === "approved" &&
        parsed.data.kind === "payment" &&
        process.env.PAYMENT_CONFIRM_ON_APPROVAL_ONLY !== "false"
      ) {
        const { data: student } = await auth.supabase
          .from("students")
          .select("full_name, guardian_phone, vendor_id, id")
          .eq("id", (row as { student_id: string }).student_id)
          .maybeSingle();

        if (student?.guardian_phone) {
          try {
            const { notifyPaymentConfirmation } = await import("@/lib/notify");
            await notifyPaymentConfirmation({
              to: student.guardian_phone,
              studentName: student.full_name,
              amount: String((row as { amount: number }).amount),
              vendorId: student.vendor_id,
              studentId: student.id,
            });
          } catch (waErr) {
            console.error("[payment notify]", waErr);
          }
        }
      }

      return { data: { status: nextStatus } };
    }

    return { error: "You cannot act on this record in its current status" };
  } catch (err) {
    console.error("[reviewTransactionAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to review transaction",
    };
  }
}
