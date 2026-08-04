"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
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
  is_free: z.boolean().default(false),
  discount_percent: z.coerce.number().min(0).max(100).default(0),
  blood_group: z.string().optional(),
  allergies: z.string().optional(),
  medical_conditions: z.string().optional(),
  current_medications: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  notes: z.string().optional(),
});

async function requireProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "active") throw new Error("Forbidden");
  return { supabase, user, profile };
}

export async function createStudentAction(input: z.infer<typeof studentSchema>) {
  const { supabase, user, profile } = await requireProfile();
  if (!["super_admin", "vendor_admin", "data_entry"].includes(profile.role)) {
    return { error: "Forbidden" };
  }

  const parsed = studentSchema.parse(input);

  const { data: student, error } = await supabase
    .from("students")
    .insert({
      vendor_id: parsed.vendor_id,
      branch_id: parsed.branch_id,
      admission_no: parsed.admission_no,
      full_name: parsed.full_name,
      dob: parsed.dob || null,
      gender: parsed.gender || null,
      guardian_name: parsed.guardian_name,
      guardian_phone: parsed.guardian_phone,
      address: parsed.address || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error || !student) return { error: error?.message ?? "Student create failed" };

  const [{ error: healthError }, { error: planError }] = await Promise.all([
    supabase.from("student_health_info").insert({
      student_id: student.id,
      blood_group: parsed.blood_group || null,
      allergies: parsed.allergies || null,
      medical_conditions: parsed.medical_conditions || null,
      current_medications: parsed.current_medications || null,
      emergency_contact_name: parsed.emergency_contact_name || null,
      emergency_contact_phone: parsed.emergency_contact_phone || null,
      notes: parsed.notes || null,
    }),
    supabase.from("student_fee_plans").insert({
      student_id: student.id,
      monthly_amount: parsed.is_free ? 0 : parsed.monthly_amount,
      is_free: parsed.is_free,
      discount_percent: parsed.discount_percent,
      is_current: true,
    }),
  ]);

  if (healthError || planError) {
    await supabase.from("students").delete().eq("id", student.id);
    return { error: healthError?.message ?? planError?.message ?? "Related insert failed" };
  }

  return { data: student };
}

const paymentSchema = z.object({
  student_id: z.string().uuid(),
  fee_due_id: z.string().uuid().optional(),
  amount: z.coerce.number().positive(),
  method: z.enum(["cash", "bank_transfer", "card", "online"]),
  bank_reference: z.string().optional(),
});

export async function recordPaymentAction(input: z.infer<typeof paymentSchema>) {
  const { supabase, user, profile } = await requireProfile();
  if (!["super_admin", "vendor_admin", "data_entry"].includes(profile.role)) {
    return { error: "Forbidden" };
  }

  const parsed = paymentSchema.parse(input);
  const { data: student } = await supabase
    .from("students")
    .select("id, vendor_id, branch_id")
    .eq("id", parsed.student_id)
    .single();

  if (!student) return { error: "Student not found" };

  const { data, error } = await supabase
    .from("payments")
    .insert({
      vendor_id: student.vendor_id,
      branch_id: student.branch_id,
      student_id: student.id,
      fee_due_id: parsed.fee_due_id || null,
      amount: parsed.amount,
      method: parsed.method as PaymentMethod,
      bank_reference: parsed.bank_reference || null,
      recorded_by: user.id,
      status: "pending_accountant" as ApprovalStatus,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
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
  const { supabase, user, profile } = await requireProfile();
  if (!["super_admin", "vendor_admin", "data_entry"].includes(profile.role)) {
    return { error: "Forbidden" };
  }

  const parsed = donationSchema.parse(input);
  const { data, error } = await supabase
    .from("donations")
    .insert({
      vendor_id: parsed.vendor_id,
      branch_id: parsed.branch_id,
      donor_name: parsed.donor_name,
      donor_phone: parsed.donor_phone || null,
      amount: parsed.amount,
      type: parsed.type as DonationType,
      bank_reference: parsed.bank_reference || null,
      received_by: user.id,
      status: "pending_accountant" as ApprovalStatus,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
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
  const { supabase, user, profile } = await requireProfile();
  const parsed = approvalSchema.parse(input);
  const table = parsed.kind === "payment" ? "payments" : "donations";

  const { data: row } = await supabase
    .from(table)
    .select("*")
    .eq("id", parsed.id)
    .single();

  if (!row) return { error: "Record not found" };

  const now = new Date().toISOString();

  if (profile.role === "accountant" && row.status === "pending_accountant") {
    const nextStatus: ApprovalStatus =
      parsed.decision === "approve" ? "pending_principal" : "rejected";
    const { error } = await supabase
      .from(table)
      .update({
        status: nextStatus,
        accountant_id: user.id,
        accountant_action_at: now,
        accountant_remarks: parsed.remarks || null,
      })
      .eq("id", parsed.id);
    if (error) return { error: error.message };
    return { data: { status: nextStatus } };
  }

  if (profile.role === "principal" && row.status === "pending_principal") {
    const nextStatus: ApprovalStatus =
      parsed.decision === "approve" ? "approved" : "rejected";
    const { error } = await supabase
      .from(table)
      .update({
        status: nextStatus,
        principal_id: user.id,
        principal_action_at: now,
        principal_remarks: parsed.remarks || null,
      })
      .eq("id", parsed.id);
    if (error) return { error: error.message };

    // On principal approve, ledger trigger posts atomically.
    // Guardian WhatsApp confirmation fires only after approval (default).
    if (
      nextStatus === "approved" &&
      parsed.kind === "payment" &&
      process.env.PAYMENT_CONFIRM_ON_APPROVAL_ONLY !== "false"
    ) {
      const { data: student } = await supabase
        .from("students")
        .select("full_name, guardian_phone, vendor_id, id")
        .eq("id", (row as { student_id: string }).student_id)
        .maybeSingle();

      if (student?.guardian_phone) {
        const { sendPaymentConfirmationWhatsApp } = await import(
          "@/lib/whatsapp"
        );
        await sendPaymentConfirmationWhatsApp({
          to: student.guardian_phone,
          studentName: student.full_name,
          amount: String((row as { amount: number }).amount),
          vendorId: student.vendor_id,
          studentId: student.id,
        });
      }
    }

    return { data: { status: nextStatus } };
  }

  return { error: "You cannot act on this record in its current status" };
}
