/**
 * Unified parent/staff notifications: WhatsApp + Dialog SMS.
 * Configure NOTIFY_CHANNELS=whatsapp,sms (default whatsapp).
 *
 * WhatsApp:
 * - If Meta/UltraMsg API creds exist → send via API
 * - Always return a wa.me click-to-chat URL so the UI can open WhatsApp
 */

import { sendDialogSms, isDialogSmsConfigured, type SmsResult } from "@/lib/sms/dialog";
import {
  buildWhatsAppLink,
  feeReminderMessage,
  isValidMobile,
} from "@/lib/phone";
import {
  isWhatsAppApiConfigured,
  sendAbsenceAlertWhatsApp,
  sendPaymentConfirmationWhatsApp,
  sendPaymentReminderWhatsApp,
  sendProgressNoteWhatsApp,
} from "@/lib/whatsapp";

export type NotifyChannelResult = {
  ok: boolean;
  queued?: boolean;
  error?: string;
  response?: unknown;
};

export type ReminderNotifyResult = {
  ok: boolean;
  message: string;
  phone: string;
  sms?: NotifyChannelResult;
  whatsapp?: NotifyChannelResult;
  /** Opens WhatsApp with pre-filled reminder text */
  whatsappUrl: string;
};

function channels() {
  const raw = (process.env.NOTIFY_CHANNELS || "whatsapp,sms").toLowerCase();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function asChannelResult(
  result: { ok: boolean; queued?: boolean; error?: string; response?: unknown } | undefined,
): NotifyChannelResult | undefined {
  if (!result) return undefined;
  return {
    ok: result.ok,
    queued: result.queued,
    error: result.error,
    response: result.response,
  };
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

  if (ch.has("whatsapp") && isWhatsAppApiConfigured()) {
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
}): Promise<ReminderNotifyResult> {
  const ch = channels();
  const text = feeReminderMessage({
    studentName: opts.studentName,
    amount: opts.amount,
    period: opts.period,
  });
  const whatsappUrl = buildWhatsAppLink(opts.to, text);

  if (!isValidMobile(opts.to)) {
    return {
      ok: false,
      message: "Invalid guardian phone number",
      phone: opts.to,
      whatsappUrl,
    };
  }

  let sms: SmsResult | undefined;
  let whatsapp: NotifyChannelResult | undefined;

  // Prefer API send when configured; UI still opens wa.me for manual send
  if (ch.has("whatsapp") && isWhatsAppApiConfigured()) {
    const wa = await sendPaymentReminderWhatsApp(opts);
    whatsapp = {
      ok: wa.ok,
      error: wa.error,
      response: wa.response,
    };
  }

  if (ch.has("sms") || isDialogSmsConfigured()) {
    sms = await sendDialogSms({
      to: opts.to,
      message: text,
      vendorId: opts.vendorId,
      studentId: opts.studentId,
      purpose: "payment_reminder",
    });
  }

  const smsOk = sms?.ok === true;
  const waOk = whatsapp?.ok === true;
  const ok = smsOk || waOk || Boolean(whatsappUrl);

  const parts: string[] = [];
  if (sms) {
    parts.push(
      sms.ok
        ? "SMS sent (Upview Tech)"
        : `SMS failed: ${sms.error || "unknown error"}`,
    );
  }
  if (whatsapp) {
    parts.push(whatsapp.ok ? "WhatsApp API sent" : `WhatsApp API: ${whatsapp.error}`);
  }
  parts.push("Opening WhatsApp chat…");

  return {
    ok,
    message: parts.join(" · "),
    phone: opts.to,
    sms: asChannelResult(sms),
    whatsapp,
    whatsappUrl,
  };
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
  const text = `Madarasa attendance: ${opts.studentName} was marked ${opts.status} on ${opts.date}.`;

  if (ch.has("whatsapp") && isWhatsAppApiConfigured()) {
    results.whatsapp = await sendAbsenceAlertWhatsApp(opts);
  }
  if (ch.has("sms")) {
    results.sms = await sendDialogSms({
      to: opts.to,
      message: text,
      vendorId: opts.vendorId,
      studentId: opts.studentId,
      purpose: "absence_alert",
    });
  }
  results.whatsappUrl = buildWhatsAppLink(opts.to, text);
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
  const text = `Madarasa progress (${opts.stream}): ${opts.studentName} — ${opts.lesson}${opts.note ? `. ${opts.note}` : ""}`;

  if (ch.has("whatsapp") && isWhatsAppApiConfigured()) {
    results.whatsapp = await sendProgressNoteWhatsApp(opts);
  }
  if (ch.has("sms")) {
    results.sms = await sendDialogSms({
      to: opts.to,
      message: text,
      vendorId: opts.vendorId,
      studentId: opts.studentId,
      purpose: "progress_note",
    });
  }
  results.whatsappUrl = buildWhatsAppLink(opts.to, text);
  return results;
}

export function notificationStatus() {
  return {
    channels: [...channels()],
    dialogConfigured: isDialogSmsConfigured(),
    whatsappApiConfigured: isWhatsAppApiConfigured(),
    smsMask:
      process.env.DIALOG_SMS_MASK ||
      process.env.DIALOG_SMS_SENDER ||
      "Upview Tech",
  };
}
