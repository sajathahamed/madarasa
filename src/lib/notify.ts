/**
 * Unified parent/staff notifications: WhatsApp + Dialog SMS.
 * Configure NOTIFY_CHANNELS=whatsapp,sms (default whatsapp).
 */

import { sendDialogSms, isDialogSmsConfigured } from "@/lib/sms/dialog";
import {
  sendAbsenceAlertWhatsApp,
  sendPaymentConfirmationWhatsApp,
  sendPaymentReminderWhatsApp,
  sendProgressNoteWhatsApp,
} from "@/lib/whatsapp";

function channels() {
  const raw = (process.env.NOTIFY_CHANNELS || "whatsapp").toLowerCase();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export async function notifyPaymentConfirmation(opts: {
  to: string;
  studentName: string;
  amount: string;
  vendorId?: string | null;
  studentId?: string | null;
}) {
  const ch = channels();
  const results: Record<string, unknown> = {};

  if (ch.has("whatsapp")) {
    results.whatsapp = await sendPaymentConfirmationWhatsApp(opts);
  }
  if (ch.has("sms")) {
    results.sms = await sendDialogSms({
      to: opts.to,
      message: `Madarasa: Payment of ${opts.amount} for ${opts.studentName} has been approved. JazakAllah khair.`,
      vendorId: opts.vendorId,
      studentId: opts.studentId,
      purpose: "payment_confirmation",
    });
  }
  return results;
}

export async function notifyPaymentReminder(opts: {
  to: string;
  studentName: string;
  amount: string;
  period: string;
  vendorId?: string | null;
  studentId?: string | null;
}) {
  const ch = channels();
  const results: Record<string, unknown> = {};

  if (ch.has("whatsapp")) {
    results.whatsapp = await sendPaymentReminderWhatsApp(opts);
  }
  if (ch.has("sms")) {
    results.sms = await sendDialogSms({
      to: opts.to,
      message: `Madarasa fee reminder: ${opts.studentName} has ${opts.amount} outstanding for ${opts.period}. Please settle at the office.`,
      vendorId: opts.vendorId,
      studentId: opts.studentId,
      purpose: "payment_reminder",
    });
  }
  return results;
}

export async function notifyAbsence(opts: {
  to: string;
  studentName: string;
  date: string;
  status: string;
  vendorId?: string | null;
  studentId?: string | null;
}) {
  const ch = channels();
  const results: Record<string, unknown> = {};

  if (ch.has("whatsapp")) {
    results.whatsapp = await sendAbsenceAlertWhatsApp(opts);
  }
  if (ch.has("sms")) {
    results.sms = await sendDialogSms({
      to: opts.to,
      message: `Madarasa attendance: ${opts.studentName} was marked ${opts.status} on ${opts.date}.`,
      vendorId: opts.vendorId,
      studentId: opts.studentId,
      purpose: "absence_alert",
    });
  }
  return results;
}

export async function notifyProgress(opts: {
  to: string;
  studentName: string;
  stream: string;
  lesson: string;
  note: string;
  vendorId?: string | null;
  studentId?: string | null;
}) {
  const ch = channels();
  const results: Record<string, unknown> = {};

  if (ch.has("whatsapp")) {
    results.whatsapp = await sendProgressNoteWhatsApp(opts);
  }
  if (ch.has("sms")) {
    results.sms = await sendDialogSms({
      to: opts.to,
      message: `Madarasa progress (${opts.stream}): ${opts.studentName} — ${opts.lesson}${opts.note ? `. ${opts.note}` : ""}`,
      vendorId: opts.vendorId,
      studentId: opts.studentId,
      purpose: "progress_note",
    });
  }
  return results;
}

export function notificationStatus() {
  return {
    channels: [...channels()],
    dialogConfigured: isDialogSmsConfigured(),
  };
}
