"use server";

import { z } from "zod";

import { requireProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
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
  class_id: z.string().uuid().optional(),
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

    if (parsed.data.class_id) {
      const { data: klass } = await auth.supabase
        .from("classes")
        .select("id, vendor_id, branch_id, section")
        .eq("id", parsed.data.class_id)
        .maybeSingle();
      if (!klass) return { error: "Class not found" };
      if (klass.vendor_id !== parsed.data.vendor_id) {
        return { error: "Class vendor mismatch" };
      }
      if (!klass.section) {
        return { error: "Pick Hifz or Sariya 1–7" };
      }
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

    if (parsed.data.class_id) {
      const { error: enrollError } = await auth.supabase
        .from("class_enrollments")
        .insert({
          class_id: parsed.data.class_id,
          student_id: student.id,
          is_active: true,
        });
      if (enrollError) {
        return {
          data: student,
          error: `Student created but enrollment failed: ${enrollError.message}`,
        };
      }
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
      .select("id, vendor_id, branch_id, full_name, guardian_phone")
      .eq("id", parsed.data.student_id)
      .maybeSingle();

    if (!student) return { error: "Student not found" };

    // Prefer selected due; otherwise oldest open due so balance reduces immediately.
    let feeDueId = parsed.data.fee_due_id || null;
    if (!feeDueId) {
      const { data: openDue } = await auth.supabase
        .from("fee_dues")
        .select("id")
        .eq("student_id", student.id)
        .neq("status", "paid")
        .order("due_year", { ascending: true })
        .order("due_month", { ascending: true })
        .limit(1)
        .maybeSingle();
      feeDueId = openDue?.id ?? null;
    }

    // RLS requires insert as pending_accountant; we auto-approve next so dues update.
    const { data: payment, error } = await auth.supabase
      .from("payments")
      .insert({
        vendor_id: student.vendor_id,
        branch_id: student.branch_id,
        student_id: student.id,
        fee_due_id: feeDueId,
        amount: parsed.data.amount,
        method: parsed.data.method as PaymentMethod,
        bank_reference: parsed.data.bank_reference || null,
        recorded_by: auth.user.id,
        status: "pending_accountant" as ApprovalStatus,
      })
      .select("id")
      .single();

    if (error || !payment) {
      return { error: error?.message ?? "Payment insert failed" };
    }

    const now = new Date().toISOString();
    const admin = createAdminClient();
    const { error: approveError } = await admin
      .from("payments")
      .update({
        status: "approved" as ApprovalStatus,
        accountant_id: auth.user.id,
        accountant_action_at: now,
        accountant_remarks: "Auto-approved on record (no review queue)",
        principal_id: auth.user.id,
        principal_action_at: now,
        principal_remarks: "Auto-approved on record (no review queue)",
      })
      .eq("id", payment.id);

    if (approveError) {
      return {
        error: `Payment saved but approve failed: ${approveError.message}`,
        paymentId: payment.id,
      };
    }

    // SMS is optional — UI asks after payment succeeds.
    return {
      ok: true as const,
      paymentId: payment.id,
      applied: true as const,
      studentName: student.full_name,
      amount: parsed.data.amount,
      guardianPhone: student.guardian_phone,
      vendorId: student.vendor_id,
      studentId: student.id,
    };
  } catch (err) {
    console.error("[recordPaymentAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to record payment",
    };
  }
}

export async function sendPaymentConfirmSmsAction(opts: {
  studentId: string;
  amount: number;
  message?: string;
}) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (
      !["super_admin", "vendor_admin", "data_entry", "accountant", "principal"].includes(
        auth.profile.role,
      )
    ) {
      return { error: "Forbidden" };
    }

    const { data: student } = await auth.supabase
      .from("students")
      .select("id, full_name, guardian_phone, vendor_id")
      .eq("id", opts.studentId)
      .maybeSingle();

    if (!student) return { error: "Student not found" };
    if (!student.guardian_phone) {
      return { error: "No guardian phone on this student" };
    }

    const amountText = Number(opts.amount).toLocaleString("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const defaultMsg = `Madarasa: Payment of ${amountText} for ${student.full_name} has been received. JazakAllah khair.`;
    const message = (opts.message || defaultMsg).trim();
    if (!message) return { error: "Message is required" };

    const { sendDialogSms, isDialogSmsConfigured } = await import(
      "@/lib/sms/dialog"
    );
    if (!isDialogSmsConfigured()) {
      return { error: "Dialog SMS (Upview Tech) is not configured" };
    }

    const result = await sendDialogSms({
      to: student.guardian_phone,
      message,
      vendorId: student.vendor_id,
      studentId: student.id,
      purpose: "payment_confirmation",
    });

    if (!result.ok) {
      return { error: result.error || "SMS failed" };
    }
    return {
      ok: true as const,
      message: "SMS sent (Upview Tech)",
      phone: student.guardian_phone,
    };
  } catch (err) {
    console.error("[sendPaymentConfirmSmsAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to send SMS",
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

    const decision = parsed.data;
    const { supabase, user, profile } = auth;
    const table = decision.kind === "payment" ? "payments" : "donations";
    const { data: row } = await supabase
      .from(table)
      .select("*")
      .eq("id", decision.id)
      .maybeSingle();

    if (!row) return { error: "Record not found" };

    const now = new Date().toISOString();
    const isFullApprover =
      profile.role === "vendor_admin" || profile.role === "super_admin";
    const canActAsAccountant = profile.role === "accountant" || isFullApprover;
    const canActAsPrincipal = profile.role === "principal" || isFullApprover;

    async function notifyPaymentApproved() {
      if (
        decision.kind !== "payment" ||
        process.env.PAYMENT_CONFIRM_ON_APPROVAL_ONLY === "false"
      ) {
        return;
      }
      const { data: student } = await supabase
        .from("students")
        .select("full_name, guardian_phone, vendor_id, id")
        .eq("id", (row as { student_id: string }).student_id)
        .maybeSingle();

      if (!student?.guardian_phone) return;
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

    // Admin can fully approve in one step (accountant + principal stages).
    if (isFullApprover && row.status === "pending_accountant") {
      const nextStatus: ApprovalStatus =
        decision.decision === "approve" ? "approved" : "rejected";
      const { error } = await supabase
        .from(table)
        .update({
          status: nextStatus,
          accountant_id: user.id,
          accountant_action_at: now,
          accountant_remarks: decision.remarks || null,
          ...(decision.decision === "approve"
            ? {
                principal_id: user.id,
                principal_action_at: now,
                principal_remarks: decision.remarks || null,
              }
            : {}),
        })
        .eq("id", decision.id);
      if (error) return { error: error.message };
      if (nextStatus === "approved") await notifyPaymentApproved();
      return { data: { status: nextStatus } };
    }

    if (canActAsAccountant && row.status === "pending_accountant") {
      const nextStatus: ApprovalStatus =
        decision.decision === "approve" ? "pending_principal" : "rejected";
      const { error } = await supabase
        .from(table)
        .update({
          status: nextStatus,
          accountant_id: user.id,
          accountant_action_at: now,
          accountant_remarks: decision.remarks || null,
        })
        .eq("id", decision.id);
      if (error) return { error: error.message };
      return { data: { status: nextStatus } };
    }

    if (canActAsPrincipal && row.status === "pending_principal") {
      const nextStatus: ApprovalStatus =
        decision.decision === "approve" ? "approved" : "rejected";
      const { error } = await supabase
        .from(table)
        .update({
          status: nextStatus,
          principal_id: user.id,
          principal_action_at: now,
          principal_remarks: decision.remarks || null,
        })
        .eq("id", decision.id);
      if (error) return { error: error.message };

      if (nextStatus === "approved") await notifyPaymentApproved();

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
