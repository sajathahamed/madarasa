/**
 * Dialog Axiata SMS integration.
 *
 * Modes:
 * 1) richcommunication — https://richcommunication.dialog.lk/api/sms/send
 *    (USER + md5 DIGEST + CREATED headers; mask sender name)
 * 2) ideamart — applicationId + password JSON API
 * 3) ideabiz — bearer token SMS API
 */

import { createHash } from "crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isValidMobile, toWhatsAppMsIsdn } from "@/lib/phone";

export type SmsResult = {
  ok: boolean;
  queued?: boolean;
  response?: unknown;
  error?: string;
};

function smsMode() {
  return (process.env.DIALOG_SMS_MODE || "richcommunication").toLowerCase();
}

function normalizePhone(phone: string) {
  return toWhatsAppMsIsdn(phone);
}

function toTelAddress(phone: string) {
  return `tel:${normalizePhone(phone)}`;
}

/** Approved Dialog Rich Communication mask (matches working PHP Send_msg). */
const UPVIEW_TECH_MASK = "Upview Tech";

function maskName() {
  const fromEnv = (
    process.env.DIALOG_SMS_MASK ||
    process.env.DIALOG_SMS_SENDER ||
    UPVIEW_TECH_MASK
  ).trim();
  // Rich Communication account requires this exact registered mask.
  return fromEnv || UPVIEW_TECH_MASK;
}

/** Public mask label for UI (always Upview Tech for this integration). */
export function dialogSmsMask() {
  return UPVIEW_TECH_MASK;
}

function richCommCredentials() {
  const username =
    process.env.DIALOG_SMS_USER || process.env.DIALOG_APP_ID || "";
  const password = process.env.DIALOG_PASSWORD || process.env.DIALOG_SMS_PASSWORD || "";
  return { username, password };
}

export type SmsLogMeta = {
  vendorId?: string | null;
  branchId?: string | null;
  senderId?: string | null;
  senderName?: string | null;
  recipientName?: string | null;
  studentId?: string | null;
  staffId?: string | null;
  purpose?: string;
};

async function logSms(opts: {
  to: string;
  body: string;
  status: string;
  response: unknown;
} & SmsLogMeta) {
  const sentAt = opts.status === "sent" ? new Date().toISOString() : null;
  const smsRow = {
    vendor_id: opts.vendorId ?? null,
    branch_id: opts.branchId ?? null,
    sender_id: opts.senderId ?? null,
    sender_name: opts.senderName ?? null,
    recipient_phone: normalizePhone(opts.to),
    recipient_name: opts.recipientName ?? null,
    student_id: opts.studentId ?? null,
    staff_id: opts.staffId ?? null,
    message_body: opts.body,
    purpose: opts.purpose || "message",
    status: opts.status,
    provider_response: {
      channel: "dialog_sms",
      mode: smsMode(),
      mask: UPVIEW_TECH_MASK,
      result: opts.response,
    } as never,
    sent_at: sentAt,
  };

  // Legacy mirror (body kept inside provider_response for older screens)
  const legacyRow = {
    vendor_id: opts.vendorId ?? null,
    student_id: opts.studentId ?? null,
    recipient_phone: normalizePhone(opts.to),
    message_type: "bulk_reminder",
    template_name: `sms:${opts.purpose || "message"}`,
    status: opts.status,
    provider_response: {
      channel: "dialog_sms",
      mode: smsMode(),
      mask: UPVIEW_TECH_MASK,
      body: opts.body,
      sender_name: opts.senderName ?? null,
      recipient_name: opts.recipientName ?? null,
      result: opts.response,
    } as never,
    sent_at: sentAt,
  };

  try {
    const admin = createAdminClient();
    const [{ error: smsErr }, { error: legacyErr }] = await Promise.all([
      admin.from("sms_messages").insert(smsRow),
      admin.from("whatsapp_messages").insert(legacyRow),
    ]);
    if (smsErr) console.error("[sms_messages log]", smsErr.message);
    if (legacyErr) console.error("[whatsapp_messages log]", legacyErr.message);
  } catch {
    try {
      const supabase = await createClient();
      await Promise.all([
        supabase.from("sms_messages").insert(smsRow),
        supabase.from("whatsapp_messages").insert({
          ...legacyRow,
          status: "queued",
        }),
      ]);
    } catch (err) {
      console.error("[sms log]", err);
    }
  }
}

/**
 * Dialog Rich Communication API (same contract as Marketing/Send_msg PHP).
 * Numbers may be a single MSISDN or comma-separated list.
 */
async function sendViaRichCommunication(
  numbers: string[],
  message: string,
): Promise<SmsResult> {
  const { username, password } = richCommCredentials();
  const url =
    process.env.DIALOG_SMS_URL ||
    "https://richcommunication.dialog.lk/api/sms/send";

  if (!username || !password) {
    return {
      ok: false,
      queued: true,
      error: "Dialog Rich Communication credentials not configured",
      response: null,
    };
  }

  const normalized = numbers.map(normalizePhone).filter(Boolean);
  if (normalized.length === 0) {
    return { ok: false, error: "No valid phone numbers", response: null };
  }

  const now = new Date();
  // Asia/Colombo-ish ISO local without timezone suffix (matches PHP Y-m-d\TH:i:s)
  const created = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(now)
    .replace(" ", "T");

  const digest = createHash("md5").update(password).digest("hex");
  // Contract mirrors working PHP Send_msg(): USER/DIGEST/CREATED + messages[]
  const requestData = {
    messages: [
      {
        clientRef: process.env.DIALOG_SMS_CLIENT_REF || "RPOSbyUpview",
        number: normalized.join(","),
        mask: UPVIEW_TECH_MASK,
        text: message,
        campaignName: process.env.DIALOG_SMS_CAMPAIGN || "restsaaspos",
      },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      USER: username,
      DIGEST: digest,
      CREATED: created,
    },
    body: JSON.stringify(requestData),
  });

  const raw = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    json = { raw };
  }

  // PHP success: resultDesc == 'SUCCESS'
  const resultDesc = String(json?.resultDesc ?? "");
  const ok = resultDesc === "SUCCESS";

  return {
    ok,
    response: json,
    error: ok
      ? undefined
      : resultDesc ||
        String(json?.result ?? "") ||
        JSON.stringify(json ?? { status: res.status }),
  };
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
  const sender = maskName();

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

export async function sendDialogSms(
  opts: {
    to: string;
    message: string;
  } & SmsLogMeta,
): Promise<SmsResult> {
  if (process.env.DIALOG_SMS_ENABLED === "false") {
    return { ok: false, queued: true, error: "Dialog SMS disabled" };
  }

  const digits = opts.to.replace(/\D/g, "");
  if (!isValidMobile(opts.to) || /^0+$/.test(digits)) {
    return { ok: false, error: "Invalid phone number", response: null };
  }

  const mode = smsMode();
  let result: SmsResult;

  if (mode === "ideabiz") {
    result = await sendViaIdeabiz(opts.to, opts.message);
  } else if (mode === "ideamart") {
    result = await sendViaIdeamart(opts.to, opts.message);
  } else {
    result = await sendViaRichCommunication([opts.to], opts.message);
  }

  const status = result.ok ? "sent" : result.queued ? "queued" : "failed";
  await logSms({
    to: opts.to,
    body: opts.message,
    status,
    response: result.response ?? { error: result.error },
    vendorId: opts.vendorId,
    branchId: opts.branchId,
    senderId: opts.senderId,
    senderName: opts.senderName,
    recipientName: opts.recipientName,
    studentId: opts.studentId,
    staffId: opts.staffId,
    purpose: opts.purpose,
  });

  return result;
}

/** Bulk SMS via Rich Communication (comma-joined numbers), one API call. */
export async function sendDialogSmsBulk(
  opts: {
    to: string[];
    message: string;
    /** Parallel to `to` — used when logging SMS against students. */
    studentIds?: (string | null | undefined)[];
    staffIds?: (string | null | undefined)[];
    recipientNames?: (string | null | undefined)[];
  } & Omit<SmsLogMeta, "studentId" | "staffId" | "recipientName">,
): Promise<SmsResult> {
  if (process.env.DIALOG_SMS_ENABLED === "false") {
    return { ok: false, queued: true, error: "Dialog SMS disabled" };
  }

  const mode = smsMode();
  if (mode !== "richcommunication" && mode !== "rich" && mode !== "dialog") {
    // Fall back: send one-by-one for other providers
    let okCount = 0;
    let last: SmsResult = { ok: false, error: "No recipients" };
    for (let i = 0; i < opts.to.length; i++) {
      last = await sendDialogSms({
        to: opts.to[i],
        message: opts.message,
        vendorId: opts.vendorId,
        branchId: opts.branchId,
        senderId: opts.senderId,
        senderName: opts.senderName,
        studentId: opts.studentIds?.[i] ?? null,
        staffId: opts.staffIds?.[i] ?? null,
        recipientName: opts.recipientNames?.[i] ?? null,
        purpose: opts.purpose,
      });
      if (last.ok) okCount++;
    }
    return {
      ok: okCount > 0,
      response: { sent: okCount, total: opts.to.length },
      error: okCount === opts.to.length ? undefined : last.error,
    };
  }

  const result = await sendViaRichCommunication(opts.to, opts.message);
  const status = result.ok ? "sent" : result.queued ? "queued" : "failed";

  await Promise.all(
    opts.to.map((phone, i) =>
      logSms({
        to: phone,
        body: opts.message,
        status,
        response: result.response ?? { error: result.error },
        vendorId: opts.vendorId,
        branchId: opts.branchId,
        senderId: opts.senderId,
        senderName: opts.senderName,
        studentId: opts.studentIds?.[i] ?? null,
        staffId: opts.staffIds?.[i] ?? null,
        recipientName: opts.recipientNames?.[i] ?? null,
        purpose: opts.purpose || "bulk",
      }),
    ),
  );

  return result;
}

export function isDialogSmsConfigured() {
  if (process.env.DIALOG_SMS_ENABLED === "false") return false;
  const mode = smsMode();
  if (mode === "ideabiz") {
    return Boolean(process.env.DIALOG_IDEABIZ_ACCESS_TOKEN);
  }
  if (mode === "ideamart") {
    return Boolean(process.env.DIALOG_APP_ID && process.env.DIALOG_PASSWORD);
  }
  const { username, password } = richCommCredentials();
  return Boolean(username && password);
}
