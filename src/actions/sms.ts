"use server";

import { z } from "zod";

import { canSendSms, requireProfile } from "@/lib/auth/session";
import { isValidMobile, toWhatsAppMsIsdn } from "@/lib/phone";
import {
  dialogSmsMask,
  isDialogSmsConfigured,
  sendDialogSmsBulk,
} from "@/lib/sms/dialog";

const recipientSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  phone: z.string().trim().min(9, "Phone is required"),
});

const customSmsSchema = z.object({
  message: z.string().trim().min(1, "Message is required").max(1000),
  recipients: z.array(recipientSchema).min(1).max(50),
});

const bulkStudentSmsSchema = z.object({
  message: z.string().trim().min(1, "Message is required").max(1000),
  studentIds: z.array(z.string().uuid()).min(1).max(400),
});

const BULK_CHUNK_SIZE = 50;

export type CustomSmsRecipientResult = {
  name: string;
  phone: string;
  ok: boolean;
  queued?: boolean;
  error?: string;
};

export type BulkStudentSmsResult = {
  studentId: string;
  name: string;
  phone: string;
  status: "sent" | "failed" | "skipped";
  error?: string;
};

export async function sendCustomSmsAction(input: {
  message: string;
  recipients: { name: string; phone: string }[];
}) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };

    if (!canSendSms(auth.profile.role)) {
      return { error: "Forbidden" };
    }

    const parsed = customSmsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        error: parsed.error.issues.map((i) => i.message).join("; "),
      };
    }

    if (!isDialogSmsConfigured()) {
      return {
        error:
          "Dialog SMS is not configured. Add DIALOG_SMS credentials in the environment.",
      };
    }

    const { message, recipients } = parsed.data;
    const results: CustomSmsRecipientResult[] = [];
    const validPhones: string[] = [];
    const validRecipients: { name: string; phone: string }[] = [];

    for (const recipient of recipients) {
      if (!isValidMobile(recipient.phone)) {
        results.push({
          name: recipient.name,
          phone: recipient.phone,
          ok: false,
          error: "Invalid phone number",
        });
        continue;
      }
      validPhones.push(toWhatsAppMsIsdn(recipient.phone));
      validRecipients.push(recipient);
    }

    if (validPhones.length === 0) {
      return {
        ok: false,
        sent: 0,
        failed: results.length,
        results,
        mask: dialogSmsMask(),
        message: "No valid phone numbers",
        resultDesc: undefined as string | undefined,
      };
    }

    // One Rich Communication call with comma-separated numbers (PHP Send_msg style).
    const api = await sendDialogSmsBulk({
      to: validPhones,
      message,
      vendorId: auth.profile.vendor_id,
      purpose: "custom_sms",
    });

    const resultDesc =
      api.response &&
      typeof api.response === "object" &&
      "resultDesc" in api.response
        ? String((api.response as { resultDesc?: unknown }).resultDesc ?? "")
        : undefined;

    for (const recipient of validRecipients) {
      results.push({
        name: recipient.name,
        phone: recipient.phone,
        ok: api.ok,
        queued: api.queued,
        error: api.ok ? undefined : api.error || resultDesc || "Failed",
      });
    }

    const sent = results.filter((r) => r.ok).length;
    const failed = results.length - sent;

    return {
      ok: api.ok,
      sent,
      failed,
      results,
      mask: dialogSmsMask(),
      resultDesc,
      response: api.response,
      message: api.ok
        ? `Dialog SUCCESS — SMS sent to ${sent} recipient${sent === 1 ? "" : "s"} (mask ${dialogSmsMask()})`
        : api.error ||
          resultDesc ||
          `Dialog rejected the send${resultDesc ? `: ${resultDesc}` : ""}`,
    };
  } catch (err) {
    console.error("[sendCustomSmsAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to send SMS",
    };
  }
}

export async function sendBulkStudentSmsAction(input: {
  message: string;
  studentIds: string[];
}) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };

    if (!canSendSms(auth.profile.role)) {
      return { error: "Forbidden" };
    }

    const parsed = bulkStudentSmsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        error: parsed.error.issues.map((i) => i.message).join("; "),
      };
    }

    if (!isDialogSmsConfigured()) {
      return {
        error:
          "Dialog SMS is not configured. Add DIALOG_SMS credentials in the environment.",
      };
    }

    const { message, studentIds } = parsed.data;
    const uniqueIds = [...new Set(studentIds)];

    let studentsQ = auth.supabase
      .from("students")
      .select("id, full_name, guardian_phone, status")
      .in("id", uniqueIds)
      .eq("status", "active");

    if (auth.profile.vendor_id) {
      studentsQ = studentsQ.eq("vendor_id", auth.profile.vendor_id);
    }
    if (auth.profile.branch_id) {
      studentsQ = studentsQ.eq("branch_id", auth.profile.branch_id);
    }

    const { data: students, error: studentsError } = await studentsQ;
    if (studentsError) {
      return { error: studentsError.message };
    }

    const byId = new Map((students ?? []).map((s) => [s.id, s]));
    const results: BulkStudentSmsResult[] = [];
    const toSend: { studentId: string; name: string; phone: string }[] = [];

    for (const id of uniqueIds) {
      const student = byId.get(id);
      if (!student) {
        results.push({
          studentId: id,
          name: "Unknown",
          phone: "",
          status: "skipped",
          error: "Student not found or not in your branch",
        });
        continue;
      }

      const phone = (student.guardian_phone || "").trim();
      if (!phone) {
        results.push({
          studentId: student.id,
          name: student.full_name,
          phone: "",
          status: "skipped",
          error: "No phone number",
        });
        continue;
      }

      if (!isValidMobile(phone)) {
        results.push({
          studentId: student.id,
          name: student.full_name,
          phone,
          status: "skipped",
          error: "Invalid phone number",
        });
        continue;
      }

      toSend.push({
        studentId: student.id,
        name: student.full_name,
        phone,
      });
    }

    if (toSend.length === 0) {
      const skipped = results.filter((r) => r.status === "skipped").length;
      return {
        ok: false,
        sent: 0,
        failed: 0,
        skipped,
        results,
        mask: dialogSmsMask(),
        message: "No students with valid phone numbers to send to",
        resultDesc: undefined as string | undefined,
      };
    }

    let allOk = true;
    let lastResultDesc: string | undefined;
    let lastError: string | undefined;

    for (let i = 0; i < toSend.length; i += BULK_CHUNK_SIZE) {
      const chunk = toSend.slice(i, i + BULK_CHUNK_SIZE);
      const api = await sendDialogSmsBulk({
        to: chunk.map((r) => toWhatsAppMsIsdn(r.phone)),
        message,
        vendorId: auth.profile.vendor_id,
        purpose: "bulk_student_sms",
        studentIds: chunk.map((r) => r.studentId),
      });

      const resultDesc =
        api.response &&
        typeof api.response === "object" &&
        "resultDesc" in api.response
          ? String((api.response as { resultDesc?: unknown }).resultDesc ?? "")
          : undefined;
      if (resultDesc) lastResultDesc = resultDesc;
      if (!api.ok) {
        allOk = false;
        lastError = api.error || resultDesc || "Failed";
      }

      for (const recipient of chunk) {
        results.push({
          studentId: recipient.studentId,
          name: recipient.name,
          phone: recipient.phone,
          status: api.ok ? "sent" : "failed",
          error: api.ok ? undefined : api.error || resultDesc || "Failed",
        });
      }
    }

    const sent = results.filter((r) => r.status === "sent").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const skipped = results.filter((r) => r.status === "skipped").length;

    const parts = [
      `Sent ${sent}`,
      failed ? `failed ${failed}` : null,
      skipped ? `skipped ${skipped}` : null,
    ].filter(Boolean);

    return {
      ok: allOk && sent > 0,
      sent,
      failed,
      skipped,
      results,
      mask: dialogSmsMask(),
      resultDesc: lastResultDesc,
      message: allOk
        ? `Dialog SUCCESS — ${parts.join(", ")} (mask ${dialogSmsMask()})`
        : lastError ||
          `Dialog rejected the send${lastResultDesc ? `: ${lastResultDesc}` : ""} · ${parts.join(", ")}`,
    };
  } catch (err) {
    console.error("[sendBulkStudentSmsAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to send SMS",
    };
  }
}
