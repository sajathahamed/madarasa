"use server";

import { z } from "zod";

import { canEnterData, requireProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  notifyAbsence,
  notifyPaymentReminder,
} from "@/lib/notify";

const updateStudentSchema = z.object({
  id: z.string().uuid(),
  admission_no: z.string().min(1),
  full_name: z.string().min(2),
  dob: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  guardian_name: z.string().min(2),
  guardian_phone: z.string().min(8),
  address: z.string().optional().nullable(),
  photo_url: z.string().optional().nullable(),
  status: z.enum(["active", "left", "graduated"]),
  blood_group: z.string().optional().nullable(),
  allergies: z.string().optional().nullable(),
  medical_conditions: z.string().optional().nullable(),
  current_medications: z.string().optional().nullable(),
  emergency_contact_name: z.string().optional().nullable(),
  emergency_contact_phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function updateStudentAction(
  input: z.infer<typeof updateStudentSchema>,
) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (!canEnterData(auth.profile.role)) return { error: "Forbidden" };

    const parsed = updateStudentSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues.map((i) => i.message).join("; ") };
    }

    const { id, blood_group, allergies, medical_conditions, current_medications,
      emergency_contact_name, emergency_contact_phone, notes, ...studentFields } =
      parsed.data;

    const { error } = await auth.supabase
      .from("students")
      .update({
        ...studentFields,
        dob: studentFields.dob || null,
        gender: studentFields.gender || null,
        address: studentFields.address || null,
        photo_url: studentFields.photo_url || null,
      })
      .eq("id", id);

    if (error) return { error: error.message };

    const { error: healthError } = await auth.supabase
      .from("student_health_info")
      .upsert({
        student_id: id,
        blood_group: blood_group || null,
        allergies: allergies || null,
        medical_conditions: medical_conditions || null,
        current_medications: current_medications || null,
        emergency_contact_name: emergency_contact_name || null,
        emergency_contact_phone: emergency_contact_phone || null,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      });

    if (healthError) return { error: healthError.message };
    return { ok: true as const };
  } catch (err) {
    console.error("[updateStudentAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to update student",
    };
  }
}

const feePlanSchema = z.object({
  student_id: z.string().uuid(),
  monthly_amount: z.coerce.number().min(0),
  is_free: z.boolean().optional().default(false),
  discount_percent: z.coerce.number().min(0).max(100).optional().default(0),
});

export async function changeFeePlanAction(
  input: z.infer<typeof feePlanSchema>,
) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (!canEnterData(auth.profile.role)) return { error: "Forbidden" };

    const parsed = feePlanSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues.map((i) => i.message).join("; ") };
    }

    await auth.supabase
      .from("student_fee_plans")
      .update({ is_current: false })
      .eq("student_id", parsed.data.student_id)
      .eq("is_current", true);

    const { error } = await auth.supabase.from("student_fee_plans").insert({
      student_id: parsed.data.student_id,
      monthly_amount: parsed.data.is_free ? 0 : parsed.data.monthly_amount,
      is_free: parsed.data.is_free ?? false,
      discount_percent: parsed.data.discount_percent ?? 0,
      is_current: true,
      effective_from: new Date().toISOString().slice(0, 10),
    });

    if (error) return { error: error.message };
    return { ok: true as const };
  } catch (err) {
    console.error("[changeFeePlanAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to change fee plan",
    };
  }
}

export async function generateDuesAction(month?: number, year?: number) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (
      !["super_admin", "vendor_admin", "accountant", "principal"].includes(
        auth.profile.role,
      )
    ) {
      return { error: "Forbidden" };
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("generate_monthly_fee_dues", {
      p_month: month,
      p_year: year,
    });
    if (error) return { error: error.message };
    return { ok: true as const, generated: data as number };
  } catch (err) {
    console.error("[generateDuesAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to generate dues",
    };
  }
}

export async function sendFeeReminderAction(dueId: string) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (
      !["super_admin", "vendor_admin", "accountant", "principal", "data_entry"].includes(
        auth.profile.role,
      )
    ) {
      return { error: "Forbidden" };
    }

    const { data: due } = await auth.supabase
      .from("fee_dues")
      .select(
        "id, total_due, amount_paid, due_month, due_year, vendor_id, student_id",
      )
      .eq("id", dueId)
      .maybeSingle();

    if (!due) return { error: "Due not found" };

    const { data: student } = await auth.supabase
      .from("students")
      .select("full_name, guardian_phone")
      .eq("id", due.student_id)
      .maybeSingle();

    if (!student?.guardian_phone) return { error: "No guardian phone" };

    const outstanding = Number(due.total_due) - Number(due.amount_paid);
    await notifyPaymentReminder({
      to: student.guardian_phone,
      studentName: student.full_name,
      amount: String(outstanding.toFixed(2)),
      period: `${due.due_month}/${due.due_year}`,
      vendorId: due.vendor_id,
      studentId: due.student_id,
    });
    return { ok: true as const };
  } catch (err) {
    console.error("[sendFeeReminderAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to send reminder",
    };
  }
}

export async function sendBulkFeeRemindersAction(dueIds: string[]) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (
      !["super_admin", "vendor_admin", "accountant", "principal"].includes(
        auth.profile.role,
      )
    ) {
      return { error: "Forbidden" };
    }

    let sent = 0;
    let failed = 0;
    for (const id of dueIds.slice(0, 100)) {
      const result = await sendFeeReminderAction(id);
      if (result.error) failed += 1;
      else sent += 1;
    }
    return { ok: true as const, sent, failed };
  } catch (err) {
    console.error("[sendBulkFeeRemindersAction]", err);
    return {
      error: err instanceof Error ? err.message : "Bulk reminder failed",
    };
  }
}

export async function notifyAbsenceAction(opts: {
  studentId: string;
  sessionDate: string;
  status: string;
}) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };

    const { data: student } = await auth.supabase
      .from("students")
      .select("id, full_name, guardian_phone, vendor_id")
      .eq("id", opts.studentId)
      .maybeSingle();

    if (!student?.guardian_phone) return { error: "No guardian phone" };

    await notifyAbsence({
      to: student.guardian_phone,
      studentName: student.full_name,
      date: opts.sessionDate,
      status: opts.status,
      vendorId: student.vendor_id,
      studentId: student.id,
    });
    return { ok: true as const };
  } catch (err) {
    console.error("[notifyAbsenceAction]", err);
    return {
      error: err instanceof Error ? err.message : "Absence notify failed",
    };
  }
}
