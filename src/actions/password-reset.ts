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

const requestSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(9, "Enter a valid phone number")
    .refine((v) => isValidMobile(v), "Enter a valid phone number"),
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

type PhoneLookupRow = {
  id: string;
  phone: string | null;
  email: string | null;
};

export type PasswordResetRequestResult =
  | {
      ok: true;
      resetId?: string;
      maskedPhone?: string;
      message: string;
    }
  | { error: string };

export async function requestPasswordResetOtpAction(input: {
  phone: string;
}): Promise<PasswordResetRequestResult> {
  try {
    const parsed = requestSchema.safeParse(input);
    if (!parsed.success) {
      return {
        error:
          parsed.error.issues[0]?.message || "Enter a valid phone number",
      };
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

    const rawPhone = parsed.data.phone.trim();
    const normalizedPhone = toWhatsAppMsIsdn(rawPhone);

    const { data: lookupRows, error: lookupError } = await admin.rpc(
      "lookup_app_user_by_phone",
      { p_phone: rawPhone },
    );

    if (lookupError) {
      console.error("[requestPasswordResetOtp] lookup", lookupError);
      // Fallback: app-level scan if RPC is not applied yet
      const fallback = await lookupAppUserByPhoneFallback(admin, normalizedPhone);
      if (fallback.error) {
        return { error: fallback.error };
      }
      if (!fallback.user) {
        return await phoneNotFoundResult(admin, rawPhone, normalizedPhone);
      }
      return await issueOtp(admin, fallback.user, normalizedPhone);
    }

    const authUser = (
      Array.isArray(lookupRows) ? lookupRows[0] : null
    ) as PhoneLookupRow | null;

    if (!authUser?.id) {
      return await phoneNotFoundResult(admin, rawPhone, normalizedPhone);
    }

    return await issueOtp(
      admin,
      {
        id: authUser.id,
        email: authUser.email,
        phone: authUser.phone || normalizedPhone,
      },
      normalizedPhone,
    );
  } catch (err) {
    console.error("[requestPasswordResetOtpAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to request OTP",
    };
  }
}

async function phoneNotFoundResult(
  admin: ReturnType<typeof createAdminClient>,
  rawPhone: string,
  normalizedPhone: string,
): Promise<PasswordResetRequestResult> {
  const { data: staffExists, error: staffError } = await admin.rpc(
    "staff_phone_exists",
    { p_phone: rawPhone },
  );

  if (!staffError && staffExists === true) {
    return {
      error:
        "This phone is on a staff record but has no login account. Ask an administrator to create a user login.",
    };
  }

  if (staffError) {
    // Fallback staff check if RPC missing
    const staffHit = await staffPhoneExistsFallback(admin, normalizedPhone);
    if (staffHit) {
      return {
        error:
          "This phone is on a staff record but has no login account. Ask an administrator to create a user login.",
      };
    }
  }

  return {
    error: "No account found for that phone number.",
  };
}

async function issueOtp(
  admin: ReturnType<typeof createAdminClient>,
  user: { id: string; email: string | null; phone: string },
  normalizedPhone: string,
): Promise<PasswordResetRequestResult> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: byUser } = await admin
    .from("password_reset_otps")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", hourAgo);

  const { count: byPhone } = await admin
    .from("password_reset_otps")
    .select("id", { count: "exact", head: true })
    .eq("phone", normalizedPhone)
    .gte("created_at", hourAgo);

  if (
    (byUser ?? 0) >= MAX_REQUESTS_PER_HOUR ||
    (byPhone ?? 0) >= MAX_REQUESTS_PER_HOUR
  ) {
    return {
      error: "Too many reset attempts. Please wait and try again later.",
    };
  }

  let email = (user.email || "").trim().toLowerCase();
  if (!email) {
    const { data: authUser, error: authError } =
      await admin.auth.admin.getUserById(user.id);
    if (authError || !authUser.user?.email) {
      return {
        error:
          "Login account is missing an email. Contact an administrator.",
      };
    }
    email = authUser.user.email.toLowerCase();
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
  const sendTo = user.phone || normalizedPhone;

  const { data: row, error: insertError } = await admin
    .from("password_reset_otps")
    .insert({
      user_id: user.id,
      email,
      phone: normalizedPhone,
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
    to: sendTo,
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
    maskedPhone: maskPhone(sendTo),
    message: `OTP sent by SMS to ${maskPhone(sendTo)}.`,
  };
}

async function lookupAppUserByPhoneFallback(
  admin: ReturnType<typeof createAdminClient>,
  normalizedPhone: string,
): Promise<
  | { user: { id: string; email: string | null; phone: string }; error?: never }
  | { user: null; error?: string }
> {
  const { data: rows, error } = await admin
    .from("app_users")
    .select("id, phone, whatsapp_number, status")
    .eq("status", "active")
    .or("phone.not.is.null,whatsapp_number.not.is.null")
    .limit(500);

  if (error) {
    console.error("[requestPasswordResetOtp] fallback lookup", error);
    return { user: null, error: "Unable to process reset request right now" };
  }

  for (const row of rows ?? []) {
    const candidates = [row.phone, row.whatsapp_number];
    for (const raw of candidates) {
      if (!raw) continue;
      if (toWhatsAppMsIsdn(raw) === normalizedPhone) {
        return {
          user: {
            id: row.id,
            email: null,
            phone: toWhatsAppMsIsdn(raw),
          },
        };
      }
    }
  }

  return { user: null };
}

async function staffPhoneExistsFallback(
  admin: ReturnType<typeof createAdminClient>,
  normalizedPhone: string,
): Promise<boolean> {
  const { data: rows } = await admin
    .from("staff_members")
    .select("phone")
    .eq("status", "active")
    .not("phone", "is", null)
    .limit(500);

  for (const row of rows ?? []) {
    if (row.phone && toWhatsAppMsIsdn(row.phone) === normalizedPhone) {
      return true;
    }
  }
  return false;
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
