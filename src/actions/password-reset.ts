"use server";

import { createHash, randomInt } from "crypto";
import { z } from "zod";

import { isValidMobile, toWhatsAppMsIsdn } from "@/lib/phone";
import {
  isDialogSmsConfigured,
  sendDialogSms,
} from "@/lib/sms/dialog";
import { createAdminClient } from "@/lib/supabase/admin";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const VERIFY_WINDOW_MS = 15 * 60 * 1000; // after verify, 15 min to set password
const MAX_REQUESTS_PER_HOUR = 5;
const GENERIC_OK =
  "If an account exists for that email and a phone number is on file, an OTP was sent by SMS.";

function hashOtp(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

function generateOtp() {
  return String(randomInt(100000, 1000000));
}

async function resolveUserPhone(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  email: string,
): Promise<string | null> {
  const { data: profile } = await admin
    .from("app_users")
    .select("phone, whatsapp_number, status")
    .eq("id", userId)
    .maybeSingle();

  if (!profile || profile.status !== "active") {
    return null;
  }

  const candidates = [
    profile.phone,
    profile.whatsapp_number,
  ];

  for (const raw of candidates) {
    const phone = (raw || "").trim();
    if (phone && isValidMobile(phone)) return phone;
  }

  // Fallback: staff directory row with the same email
  const { data: staff } = await admin
    .from("staff_members")
    .select("phone")
    .ilike("email", email.trim())
    .eq("status", "active")
    .not("phone", "is", null)
    .limit(5);

  for (const row of staff ?? []) {
    const phone = (row.phone || "").trim();
    if (phone && isValidMobile(phone)) return phone;
  }

  return null;
}

const requestSchema = z.object({
  email: z.string().email(),
});

const verifySchema = z.object({
  resetId: z.string().uuid(),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit OTP"),
});

const completeSchema = z.object({
  resetId: z.string().uuid(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6),
});

export type PasswordResetRequestResult =
  | {
      ok: true;
      resetId?: string;
      maskedPhone?: string;
      message: string;
      /** True when the account exists but has no usable phone. */
      noPhone?: boolean;
    }
  | { error: string };

export async function requestPasswordResetOtpAction(input: {
  email: string;
}): Promise<PasswordResetRequestResult> {
  try {
    const parsed = requestSchema.safeParse(input);
    if (!parsed.success) {
      return { error: "Enter a valid email address" };
    }

    if (!isDialogSmsConfigured()) {
      return {
        error:
          "SMS is not configured on the server. Contact an administrator to reset your password.",
      };
    }

    let admin: ReturnType<typeof createAdminClient>;
    try {
      admin = createAdminClient();
    } catch {
      return {
        error:
          "Server is missing elevated Supabase credentials. Contact an administrator.",
      };
    }

    const email = parsed.data.email.trim().toLowerCase();

    const { data: authRows, error: lookupError } = await admin.rpc(
      "lookup_auth_user_by_email",
      { p_email: email },
    );

    if (lookupError) {
      console.error("[requestPasswordResetOtp] lookup", lookupError);
      return { error: "Unable to process reset request right now" };
    }

    const authUser = Array.isArray(authRows) ? authRows[0] : null;

    if (!authUser?.id) {
      // Do not reveal whether the email exists.
      return { ok: true, message: GENERIC_OK };
    }

    const phone = await resolveUserPhone(admin, authUser.id, email);
    if (!phone) {
      return {
        ok: true,
        noPhone: true,
        message:
          "This account has no phone number on file. Ask an administrator to add a phone under your user profile, then try again.",
      };
    }

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("password_reset_otps")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authUser.id)
      .gte("created_at", hourAgo);

    if ((count ?? 0) >= MAX_REQUESTS_PER_HOUR) {
      return {
        error: "Too many reset attempts. Please wait and try again later.",
      };
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    const { data: row, error: insertError } = await admin
      .from("password_reset_otps")
      .insert({
        user_id: authUser.id,
        email,
        phone: toWhatsAppMsIsdn(phone),
        code_hash: hashOtp(code),
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (insertError || !row) {
      console.error("[requestPasswordResetOtp] insert", insertError);
      return { error: "Could not create reset request" };
    }

    const sms = await sendDialogSms({
      to: phone,
      message: `Madarasa password reset OTP: ${code}. Valid for 10 minutes. Do not share this code.`,
      purpose: "password_reset_otp",
    });

    if (!sms.ok) {
      await admin
        .from("password_reset_otps")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", row.id);
      return {
        error: sms.error || "Failed to send OTP SMS. Try again shortly.",
      };
    }

    return {
      ok: true,
      resetId: row.id,
      maskedPhone: maskPhone(phone),
      message: `OTP sent by SMS to ${maskPhone(phone)}.`,
    };
  } catch (err) {
    console.error("[requestPasswordResetOtpAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to request OTP",
    };
  }
}

export type PasswordResetVerifyResult =
  | { ok: true; message: string }
  | { error: string };

export async function verifyPasswordResetOtpAction(input: {
  resetId: string;
  code: string;
}): Promise<PasswordResetVerifyResult> {
  try {
    const parsed = verifySchema.safeParse(input);
    if (!parsed.success) {
      return {
        error: parsed.error.issues.map((i) => i.message).join("; "),
      };
    }

    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from("password_reset_otps")
      .select("*")
      .eq("id", parsed.data.resetId)
      .maybeSingle();

    if (error || !row) {
      return { error: "Invalid or expired reset request. Start again." };
    }

    if (row.consumed_at) {
      return { error: "This reset code was already used. Start again." };
    }

    if (new Date(row.expires_at) < new Date()) {
      return { error: "OTP expired. Request a new one." };
    }

    if (row.attempts >= row.max_attempts) {
      return { error: "Too many incorrect attempts. Request a new OTP." };
    }

    const ok = row.code_hash === hashOtp(parsed.data.code);
    if (!ok) {
      await admin
        .from("password_reset_otps")
        .update({ attempts: row.attempts + 1 })
        .eq("id", row.id);
      const left = row.max_attempts - row.attempts - 1;
      return {
        error:
          left > 0
            ? `Incorrect OTP. ${left} attempt${left === 1 ? "" : "s"} left.`
            : "Too many incorrect attempts. Request a new OTP.",
      };
    }

    const { error: verifyError } = await admin
      .from("password_reset_otps")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", row.id);

    if (verifyError) {
      return { error: verifyError.message };
    }

    return { ok: true, message: "OTP verified. Set your new password." };
  } catch (err) {
    console.error("[verifyPasswordResetOtpAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to verify OTP",
    };
  }
}

export type PasswordResetCompleteResult =
  | { ok: true; message: string }
  | { error: string };

export async function completePasswordResetAction(input: {
  resetId: string;
  password: string;
  confirmPassword: string;
}): Promise<PasswordResetCompleteResult> {
  try {
    const parsed = completeSchema.safeParse(input);
    if (!parsed.success) {
      return {
        error: parsed.error.issues.map((i) => i.message).join("; "),
      };
    }

    if (parsed.data.password !== parsed.data.confirmPassword) {
      return { error: "Passwords do not match" };
    }

    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from("password_reset_otps")
      .select("*")
      .eq("id", parsed.data.resetId)
      .maybeSingle();

    if (error || !row) {
      return { error: "Invalid or expired reset request. Start again." };
    }

    if (row.consumed_at) {
      return { error: "This reset was already completed. Sign in instead." };
    }

    if (!row.verified_at) {
      return { error: "Verify the OTP before setting a new password." };
    }

    const verifiedAt = new Date(row.verified_at).getTime();
    if (Date.now() - verifiedAt > VERIFY_WINDOW_MS) {
      return { error: "Verification expired. Request a new OTP." };
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(
      row.user_id,
      { password: parsed.data.password },
    );

    if (updateError) {
      return { error: updateError.message };
    }

    await admin
      .from("password_reset_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id);

    // Invalidate any other open OTPs for this user
    await admin
      .from("password_reset_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("user_id", row.user_id)
      .is("consumed_at", null);

    return {
      ok: true,
      message: "Password updated. You can sign in with your new password.",
    };
  } catch (err) {
    console.error("[completePasswordResetAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to update password",
    };
  }
}
