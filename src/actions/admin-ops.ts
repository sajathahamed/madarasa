"use server";

import { z } from "zod";

import { canManageAdminOps, requireProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

function assertAdmin(role: string) {
  return canManageAdminOps(role);
}

function asJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

async function scopeOk(
  auth: Awaited<ReturnType<typeof requireProfile>> & object,
  vendorId: string | null | undefined,
  branchId: string | null | undefined,
) {
  if ("error" in auth) return false;
  if (auth.profile.role === "super_admin") return true;
  if (auth.profile.vendor_id && vendorId && auth.profile.vendor_id !== vendorId) {
    return false;
  }
  if (
    auth.profile.role === "principal" &&
    auth.profile.branch_id &&
    branchId &&
    auth.profile.branch_id !== branchId
  ) {
    return false;
  }
  return true;
}

async function reverseLedger(
  admin: ReturnType<typeof createAdminClient>,
  sourceTable: "payments" | "donations",
  sourceId: string,
) {
  const { data: entries } = await admin
    .from("ledger_entries")
    .select("id, account_id, amount")
    .eq("source_table", sourceTable)
    .eq("source_id", sourceId);

  for (const entry of entries ?? []) {
    const amount = Number(entry.amount);
    const { data: account } = await admin
      .from("accounts")
      .select("id, current_balance")
      .eq("id", entry.account_id)
      .maybeSingle();
    if (account) {
      await admin
        .from("accounts")
        .update({
          current_balance: Number(account.current_balance) - amount,
        })
        .eq("id", account.id);
    }
  }

  if ((entries ?? []).length > 0) {
    await admin
      .from("ledger_entries")
      .delete()
      .eq("source_table", sourceTable)
      .eq("source_id", sourceId);
  }
}

export async function adminDeletePaymentAction(paymentId: string) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (!assertAdmin(auth.profile.role)) return { error: "Forbidden" };

    const admin = createAdminClient();
    const { data: payment } = await admin
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .maybeSingle();

    if (!payment) return { error: "Payment not found" };
    if (!(await scopeOk(auth, payment.vendor_id, payment.branch_id))) {
      return { error: "Forbidden" };
    }

    if (payment.status === "approved") {
      if (payment.fee_due_id) {
        const { data: due } = await admin
          .from("fee_dues")
          .select("*")
          .eq("id", payment.fee_due_id)
          .maybeSingle();
        if (due) {
          const newPaid = Math.max(0, Number(due.amount_paid) - Number(payment.amount));
          await admin
            .from("fee_dues")
            .update({
              amount_paid: newPaid,
              status:
                newPaid <= 0
                  ? "unpaid"
                  : newPaid >= Number(due.total_due)
                    ? "paid"
                    : "partial",
            })
            .eq("id", due.id);
        }
      }
      await reverseLedger(admin, "payments", payment.id);
    }

    const { error } = await admin.from("payments").delete().eq("id", paymentId);
    if (error) return { error: error.message };

    await admin.from("audit_logs").insert({
      vendor_id: payment.vendor_id,
      user_id: auth.user.id,
      action: "admin_delete_payment",
      table_name: "payments",
      record_id: paymentId,
      old_data: asJson(payment),
      new_data: null,
    });

    return { ok: true as const };
  } catch (err) {
    console.error("[adminDeletePaymentAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to delete payment",
    };
  }
}

export async function adminDeleteDonationAction(donationId: string) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (!assertAdmin(auth.profile.role)) return { error: "Forbidden" };

    const admin = createAdminClient();
    const { data: donation } = await admin
      .from("donations")
      .select("*")
      .eq("id", donationId)
      .maybeSingle();

    if (!donation) return { error: "Donation not found" };
    if (!(await scopeOk(auth, donation.vendor_id, donation.branch_id))) {
      return { error: "Forbidden" };
    }

    if (donation.status === "approved") {
      await reverseLedger(admin, "donations", donation.id);
    }

    const { error } = await admin.from("donations").delete().eq("id", donationId);
    if (error) return { error: error.message };

    await admin.from("audit_logs").insert({
      vendor_id: donation.vendor_id,
      user_id: auth.user.id,
      action: "admin_delete_donation",
      table_name: "donations",
      record_id: donationId,
      old_data: asJson(donation),
      new_data: null,
    });

    return { ok: true as const };
  } catch (err) {
    console.error("[adminDeleteDonationAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to delete donation",
    };
  }
}

export async function adminDeleteStudentAction(studentId: string) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (!assertAdmin(auth.profile.role)) return { error: "Forbidden" };

    const admin = createAdminClient();
    const { data: student } = await admin
      .from("students")
      .select("*")
      .eq("id", studentId)
      .maybeSingle();

    if (!student) return { error: "Student not found" };
    if (!(await scopeOk(auth, student.vendor_id, student.branch_id))) {
      return { error: "Forbidden" };
    }

    // Soft-delete: keep history, remove from active ops
    const { error } = await admin
      .from("students")
      .update({ status: "left" })
      .eq("id", studentId);
    if (error) return { error: error.message };

    await admin.from("audit_logs").insert({
      vendor_id: student.vendor_id,
      user_id: auth.user.id,
      action: "admin_soft_delete_student",
      table_name: "students",
      record_id: studentId,
      old_data: asJson({ status: student.status }),
      new_data: asJson({ status: "left" }),
    });

    return { ok: true as const };
  } catch (err) {
    console.error("[adminDeleteStudentAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to remove student",
    };
  }
}

export async function adminDeleteFeeDueAction(dueId: string) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (!assertAdmin(auth.profile.role)) return { error: "Forbidden" };

    const admin = createAdminClient();
    const { data: due } = await admin
      .from("fee_dues")
      .select("*")
      .eq("id", dueId)
      .maybeSingle();

    if (!due) return { error: "Due not found" };
    if (!(await scopeOk(auth, due.vendor_id, due.branch_id))) {
      return { error: "Forbidden" };
    }

    // Unlink payments first so delete is allowed
    await admin
      .from("payments")
      .update({ fee_due_id: null })
      .eq("fee_due_id", dueId);

    const { error } = await admin.from("fee_dues").delete().eq("id", dueId);
    if (error) return { error: error.message };

    await admin.from("audit_logs").insert({
      vendor_id: due.vendor_id,
      user_id: auth.user.id,
      action: "admin_delete_fee_due",
      table_name: "fee_dues",
      record_id: dueId,
      old_data: asJson(due),
      new_data: null,
    });

    return { ok: true as const };
  } catch (err) {
    console.error("[adminDeleteFeeDueAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to delete due",
    };
  }
}

export async function adminDeleteAttendanceSessionAction(sessionId: string) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (!assertAdmin(auth.profile.role)) return { error: "Forbidden" };

    const admin = createAdminClient();
    const { data: session } = await admin
      .from("attendance_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();

    if (!session) return { error: "Session not found" };
    if (!(await scopeOk(auth, session.vendor_id, session.branch_id))) {
      return { error: "Forbidden" };
    }

    const { error } = await admin
      .from("attendance_sessions")
      .delete()
      .eq("id", sessionId);
    if (error) return { error: error.message };

    await admin.from("audit_logs").insert({
      vendor_id: session.vendor_id,
      user_id: auth.user.id,
      action: "admin_delete_attendance_session",
      table_name: "attendance_sessions",
      record_id: sessionId,
      old_data: asJson(session),
      new_data: null,
    });

    return { ok: true as const };
  } catch (err) {
    console.error("[adminDeleteAttendanceSessionAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to delete session",
    };
  }
}

export async function adminDeleteProgressLogAction(logId: string) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (!assertAdmin(auth.profile.role)) return { error: "Forbidden" };

    const admin = createAdminClient();
    const { data: log } = await admin
      .from("islamic_progress_logs")
      .select("*")
      .eq("id", logId)
      .maybeSingle();

    if (!log) return { error: "Progress log not found" };
    if (!(await scopeOk(auth, log.vendor_id, log.branch_id))) {
      return { error: "Forbidden" };
    }

    const { error } = await admin
      .from("islamic_progress_logs")
      .delete()
      .eq("id", logId);
    if (error) return { error: error.message };

    await admin.from("audit_logs").insert({
      vendor_id: log.vendor_id,
      user_id: auth.user.id,
      action: "admin_delete_progress_log",
      table_name: "islamic_progress_logs",
      record_id: logId,
      old_data: asJson(log),
      new_data: null,
    });

    return { ok: true as const };
  } catch (err) {
    console.error("[adminDeleteProgressLogAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to delete progress",
    };
  }
}

const idSchema = z.string().uuid();

export async function adminDeleteClassAction(classId: string) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (!assertAdmin(auth.profile.role)) return { error: "Forbidden" };
    if (!idSchema.safeParse(classId).success) return { error: "Invalid id" };

    const admin = createAdminClient();
    const { data: row } = await admin
      .from("classes")
      .select("*")
      .eq("id", classId)
      .maybeSingle();

    if (!row) return { error: "Class not found" };
    if (!(await scopeOk(auth, row.vendor_id, row.branch_id))) {
      return { error: "Forbidden" };
    }

    const { error } = await admin.from("classes").delete().eq("id", classId);
    if (error) return { error: error.message };

    await admin.from("audit_logs").insert({
      vendor_id: row.vendor_id,
      user_id: auth.user.id,
      action: "admin_delete_class",
      table_name: "classes",
      record_id: classId,
      old_data: asJson(row),
      new_data: null,
    });

    return { ok: true as const };
  } catch (err) {
    console.error("[adminDeleteClassAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to delete class",
    };
  }
}
