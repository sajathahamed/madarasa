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

export type CustomSmsRecipientResult = {
  name: string;
  phone: string;
  ok: boolean;
  queued?: boolean;
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
