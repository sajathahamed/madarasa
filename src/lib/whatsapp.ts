import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type WhatsAppMessageType =
  | "credentials"
  | "payment_confirmation"
  | "payment_reminder"
  | "bulk_reminder"
  | "absence_alert"
  | "progress_note";

type SendTemplateInput = {
  to: string;
  messageType: WhatsAppMessageType;
  templateName: string;
  variables?: string[];
  vendorId?: string | null;
  studentId?: string | null;
};

type ProviderResult = {
  ok: boolean;
  response: unknown;
  error?: string;
};

function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, "");
}

async function sendViaMeta(
  to: string,
  templateName: string,
  variables: string[],
): Promise<ProviderResult> {
  const token = process.env.WHATSAPP_META_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_META_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    return {
      ok: false,
      response: null,
      error: "Meta WhatsApp credentials not configured",
    };
  }

  const body = {
    messaging_product: "whatsapp",
    to: normalizePhone(to).replace(/^\+/, ""),
    type: "template",
    template: {
      name: templateName,
      language: { code: "en" },
      components:
        variables.length > 0
          ? [
              {
                type: "body",
                parameters: variables.map((text) => ({ type: "text", text })),
              },
            ]
          : undefined,
    },
  };

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  const json = await res.json();
  return { ok: res.ok, response: json, error: res.ok ? undefined : JSON.stringify(json) };
}

async function sendViaUltraMsg(
  to: string,
  templateName: string,
  variables: string[],
): Promise<ProviderResult> {
  const instanceId = process.env.WHATSAPP_ULTRAMSG_INSTANCE_ID;
  const token = process.env.WHATSAPP_ULTRAMSG_TOKEN;

  if (!instanceId || !token) {
    return {
      ok: false,
      response: null,
      error: "UltraMsg credentials not configured",
    };
  }

  const bodyText = [`[${templateName}]`, ...variables].join("\n");
  const params = new URLSearchParams({
    token,
    to: normalizePhone(to),
    body: bodyText,
  });

  const res = await fetch(
    `https://api.ultramsg.com/${instanceId}/messages/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    },
  );

  const json = await res.json();
  return { ok: res.ok, response: json, error: res.ok ? undefined : JSON.stringify(json) };
}

export async function sendWhatsAppTemplate(input: SendTemplateInput) {
  const provider = process.env.WHATSAPP_PROVIDER ?? "meta";
  const variables = input.variables ?? [];

  let result: ProviderResult;
  if (provider === "ultramsg") {
    result = await sendViaUltraMsg(input.to, input.templateName, variables);
  } else {
    result = await sendViaMeta(input.to, input.templateName, variables);
  }

  try {
    const admin = createAdminClient();
    await admin.from("whatsapp_messages").insert({
      vendor_id: input.vendorId ?? null,
      student_id: input.studentId ?? null,
      recipient_phone: normalizePhone(input.to),
      message_type: input.messageType,
      template_name: input.templateName,
      status: result.ok ? "sent" : "failed",
      provider_response: result.response as never,
      sent_at: result.ok ? new Date().toISOString() : null,
    });
  } catch {
    try {
      const supabase = await createClient();
      await supabase.from("whatsapp_messages").insert({
        vendor_id: input.vendorId ?? null,
        student_id: input.studentId ?? null,
        recipient_phone: normalizePhone(input.to),
        message_type: input.messageType,
        template_name: input.templateName,
        status: result.ok ? "sent" : "queued",
        provider_response: {
          provider,
          result,
          note: "queued locally — configure WhatsApp + service role",
        } as never,
      });
    } catch (logErr) {
      console.error("[whatsapp log]", logErr);
    }
  }

  return result;
}

export async function sendCredentialsWhatsApp(opts: {
  to: string;
  fullName: string;
  email: string;
  tempPassword: string;
  vendorId?: string | null;
}) {
  return sendWhatsAppTemplate({
    to: opts.to,
    messageType: "credentials",
    templateName: "login_credentials",
    variables: [opts.fullName, opts.email, opts.tempPassword],
    vendorId: opts.vendorId,
  });
}

export async function sendPaymentConfirmationWhatsApp(opts: {
  to: string;
  studentName: string;
  amount: string;
  vendorId?: string | null;
  studentId?: string | null;
}) {
  return sendWhatsAppTemplate({
    to: opts.to,
    messageType: "payment_confirmation",
    templateName: "payment_confirmation",
    variables: [opts.studentName, opts.amount],
    vendorId: opts.vendorId,
    studentId: opts.studentId,
  });
}

export async function sendPaymentReminderWhatsApp(opts: {
  to: string;
  studentName: string;
  amount: string;
  period: string;
  vendorId?: string | null;
  studentId?: string | null;
}) {
  return sendWhatsAppTemplate({
    to: opts.to,
    messageType: "payment_reminder",
    templateName: "payment_reminder",
    variables: [opts.studentName, opts.amount, opts.period],
    vendorId: opts.vendorId,
    studentId: opts.studentId,
  });
}

export async function sendBulkReminderWhatsApp(opts: {
  to: string;
  studentName: string;
  amount: string;
  vendorId?: string | null;
  studentId?: string | null;
}) {
  return sendWhatsAppTemplate({
    to: opts.to,
    messageType: "bulk_reminder",
    templateName: "bulk_fee_reminder",
    variables: [opts.studentName, opts.amount],
    vendorId: opts.vendorId,
    studentId: opts.studentId,
  });
}

export async function sendAbsenceAlertWhatsApp(opts: {
  to: string;
  studentName: string;
  date: string;
  status: string;
  vendorId?: string | null;
  studentId?: string | null;
}) {
  return sendWhatsAppTemplate({
    to: opts.to,
    messageType: "absence_alert",
    templateName: "absence_alert",
    variables: [opts.studentName, opts.date, opts.status],
    vendorId: opts.vendorId,
    studentId: opts.studentId,
  });
}

export async function sendProgressNoteWhatsApp(opts: {
  to: string;
  studentName: string;
  stream: string;
  lesson: string;
  note: string;
  vendorId?: string | null;
  studentId?: string | null;
}) {
  return sendWhatsAppTemplate({
    to: opts.to,
    messageType: "progress_note",
    templateName: "progress_note",
    variables: [opts.studentName, opts.stream, opts.lesson, opts.note || "—"],
    vendorId: opts.vendorId,
    studentId: opts.studentId,
  });
}
