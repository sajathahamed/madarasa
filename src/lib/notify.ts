/**
 * Unified parent/staff notifications: WhatsApp + Dialog SMS.
 * Configure NOTIFY_CHANNELS=whatsapp,sms (default whatsapp).
 *
 * WhatsApp:
 * - If Meta/UltraMsg API creds exist → send via API
 * - Always return a wa.me click-to-chat URL so the UI can open WhatsApp
 */

import {
  sendDialogSms,
  isDialogSmsConfigured,
  dialogSmsMask,
  type SmsResult,
} from "@/lib/sms/dialog";
import {
  buildWhatsAppLink,
  feeReminderMessage,
  isValidMobile,
} from "@/lib/phone";
import { paymentApprovedSmsMessage } from "@/lib/sms/templates";
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
      message: paymentApprovedSmsMessage({
        studentName: opts.studentName,
        amount: opts.amount,
      }),
      vendorId: opts.vendorId,
      studentId: opts.studentId,
      recipientName: opts.studentName,
      purpose: "payment_confirmation",
    });
  }
  return results;
}

export type ReminderChannel = "sms" | "whatsapp";

export async function notifyPaymentReminder(opts: {
  to: string;
  studentName: string;
  amount: string;
  period: string;
  vendorId?: string | null;
  studentId?: string | null;
  branchId?: string | null;
  senderId?: string | null;
  senderName?: string | null;
  /** Default: both channels. Pass one channel for SMS-only or WhatsApp-only. */
  channel?: ReminderChannel | "both";
}): Promise<ReminderNotifyResult> {
  const mode = opts.channel ?? "both";
  const wantSms = mode === "sms" || mode === "both";
  const wantWhatsApp = mode === "whatsapp" || mode === "both";
  const envChannels = channels();

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
      whatsappUrl: wantWhatsApp ? whatsappUrl : "",
    };
  }

  let sms: SmsResult | undefined;
  let whatsapp: NotifyChannelResult | undefined;

  if (wantWhatsApp && envChannels.has("whatsapp") && isWhatsAppApiConfigured()) {
    const wa = await sendPaymentReminderWhatsApp(opts);
    whatsapp = {
      ok: wa.ok,
      error: wa.error,
      response: wa.response,
    };
  }

  if (wantSms && (envChannels.has("sms") || isDialogSmsConfigured())) {
    sms = await sendDialogSms({
      to: opts.to,
      message: text,
      vendorId: opts.vendorId,
      branchId: opts.branchId,
      senderId: opts.senderId,
      senderName: opts.senderName,
      studentId: opts.studentId,
      recipientName: opts.studentName,
      purpose: "payment_reminder",
    });
  }

  const smsOk = sms?.ok === true;
  const waApiOk = whatsapp?.ok === true;
  const ok =
    (wantSms && smsOk) ||
    (wantWhatsApp && (waApiOk || Boolean(whatsappUrl))) ||
    (!wantSms && !wantWhatsApp);

  const parts: string[] = [];
  if (wantSms) {
    if (sms) {
      parts.push(
        sms.ok
          ? "SMS sent (Upview Tech)"
          : `SMS failed: ${sms.error || "unknown error"}`,
      );
    } else if (!isDialogSmsConfigured()) {
      parts.push("SMS not configured — add Dialog SMS credentials");
    }
  }
  if (wantWhatsApp) {
    if (whatsapp) {
      parts.push(
        whatsapp.ok ? "WhatsApp API sent" : `WhatsApp API: ${whatsapp.error}`,
      );
    }
    parts.push("Opening WhatsApp chat…");
  }

  return {
    ok,
    message: parts.join(" · ") || "Done",
    phone: opts.to,
    sms: asChannelResult(sms),
    whatsapp,
    whatsappUrl: wantWhatsApp ? whatsappUrl : "",
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
      recipientName: opts.studentName,
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
      recipientName: opts.studentName,
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
    smsMask: dialogSmsMask(),
  };
}
