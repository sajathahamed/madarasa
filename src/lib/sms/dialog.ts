/**
 * Dialog Axiata SMS / Rich Communication integration.
 *
 * Supports:
 * 1) Ideamart SMS API (applicationId + password)
 * 2) Ideabiz / enterprise bearer token (optional)
 *
 * Leave credentials empty until provisioned — sends are no-ops that log queued.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type SmsResult = {
  ok: boolean;
  queued?: boolean;
  response?: unknown;
  error?: string;
};

function normalizePhone(phone: string) {
  let p = phone.replace(/[^\d+]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("0")) p = `94${p.slice(1)}`;
  return p;
}

function toTelAddress(phone: string) {
  return `tel:${normalizePhone(phone)}`;
}

async function logSms(opts: {
  to: string;
  body: string;
  status: string;
  response: unknown;
  vendorId?: string | null;
  studentId?: string | null;
  purpose?: string;
}) {
  const row = {
    vendor_id: opts.vendorId ?? null,
    student_id: opts.studentId ?? null,
    recipient_phone: normalizePhone(opts.to),
    message_type: "bulk_reminder",
    template_name: `sms:${opts.purpose || "message"}`,
    status: opts.status,
    provider_response: {
      channel: "dialog_sms",
      body: opts.body,
      result: opts.response,
    } as never,
    sent_at: opts.status === "sent" ? new Date().toISOString() : null,
  };

  try {
    const admin = createAdminClient();
    await admin.from("whatsapp_messages").insert(row);
  } catch {
    try {
      const supabase = await createClient();
      await supabase.from("whatsapp_messages").insert({
        ...row,
        status: "queued",
      });
    } catch (err) {
      console.error("[sms log]", err);
    }
  }
}

async function sendViaIdeamart(
  to: string,
  message: string,
): Promise<SmsResult> {
  const applicationId = process.env.DIALOG_APP_ID;
  const password = process.env.DIALOG_PASSWORD;
  const url =
    process.env.DIALOG_SMS_URL || "https://api.dialog.lk/sms/send";

  if (!applicationId || !password) {
    return {
      ok: false,
      queued: true,
      error: "Dialog Ideamart credentials not configured",
      response: null,
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      applicationId,
      password,
      message,
      destinationAddresses: [toTelAddress(to)],
    }),
  });

  const json = await res.json().catch(() => null);
  const ok =
    res.ok &&
    (!json ||
      json.statusCode === "S1000" ||
      json.statusCode === "S100" ||
      json.requestId);
  return {
    ok,
    response: json,
    error: ok ? undefined : JSON.stringify(json ?? { status: res.status }),
  };
}

async function sendViaIdeabiz(
  to: string,
  message: string,
): Promise<SmsResult> {
  const token = process.env.DIALOG_IDEABIZ_ACCESS_TOKEN;
  const url =
    process.env.DIALOG_IDEABIZ_SMS_URL ||
    "https://ideabiz.lk/apicall/smsmessaging/v3/outbound/requests";
  const sender =
    process.env.DIALOG_SMS_SENDER || process.env.DIALOG_APP_ID || "MADARASA";

  if (!token) {
    return {
      ok: false,
      queued: true,
      error: "Dialog Ideabiz access token not configured",
      response: null,
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      outboundSMSMessageRequest: {
        address: [toTelAddress(to)],
        senderAddress: `tel:${sender}`,
        outboundSMSTextMessage: { message },
      },
    }),
  });

  const json = await res.json().catch(() => null);
  return {
    ok: res.ok,
    response: json,
    error: res.ok ? undefined : JSON.stringify(json ?? { status: res.status }),
  };
}

export async function sendDialogSms(opts: {
  to: string;
  message: string;
  vendorId?: string | null;
  studentId?: string | null;
  purpose?: string;
}): Promise<SmsResult> {
  if (process.env.DIALOG_SMS_ENABLED === "false") {
    return { ok: false, queued: true, error: "Dialog SMS disabled" };
  }

  const mode = (process.env.DIALOG_SMS_MODE || "ideamart").toLowerCase();
  let result: SmsResult;

  if (mode === "ideabiz") {
    result = await sendViaIdeabiz(opts.to, opts.message);
  } else {
    result = await sendViaIdeamart(opts.to, opts.message);
  }

  const status = result.ok ? "sent" : result.queued ? "queued" : "failed";
  await logSms({
    to: opts.to,
    body: opts.message,
    status,
    response: result.response ?? { error: result.error },
    vendorId: opts.vendorId,
    studentId: opts.studentId,
    purpose: opts.purpose,
  });

  return result;
}

export function isDialogSmsConfigured() {
  const mode = (process.env.DIALOG_SMS_MODE || "ideamart").toLowerCase();
  if (process.env.DIALOG_SMS_ENABLED === "false") return false;
  if (mode === "ideabiz") return Boolean(process.env.DIALOG_IDEABIZ_ACCESS_TOKEN);
  return Boolean(process.env.DIALOG_APP_ID && process.env.DIALOG_PASSWORD);
}
