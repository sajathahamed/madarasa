"use server";

import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { requireProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const PARENT_COOKIE = "madarasa_parent_session";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createParentLinkAction(studentId: string) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (
      !["super_admin", "vendor_admin", "principal", "data_entry"].includes(
        auth.profile.role,
      )
    ) {
      return { error: "Forbidden" };
    }

    const { data: student } = await auth.supabase
      .from("students")
      .select("id, vendor_id, full_name")
      .eq("id", studentId)
      .maybeSingle();

    if (!student) return { error: "Student not found" };

    const raw = randomBytes(24).toString("hex");
    const tokenHash = hashToken(raw);
    const expires = new Date();
    expires.setDate(expires.getDate() + 90);

    const { error } = await auth.supabase.from("parent_access_tokens").insert({
      student_id: student.id,
      vendor_id: student.vendor_id,
      token_hash: tokenHash,
      label: `Link for ${student.full_name}`,
      expires_at: expires.toISOString(),
      created_by: auth.user.id,
    });

    if (error) return { error: error.message };

    const base =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      "http://localhost:3000";
    return {
      ok: true as const,
      url: `${base}/parent?token=${raw}`,
      token: raw,
    };
  } catch (err) {
    console.error("[createParentLinkAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to create link",
    };
  }
}

export async function parentLoginWithTokenAction(token: string) {
  try {
    const admin = createAdminClient();
    const tokenHash = hashToken(token);
    const { data: row } = await admin
      .from("parent_access_tokens")
      .select("id, student_id, expires_at, revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!row || row.revoked_at) return { error: "Invalid or revoked link" };
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return { error: "Link expired" };
    }

    await admin
      .from("parent_access_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", row.id);

    const jar = await cookies();
    jar.set(PARENT_COOKIE, row.student_id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return { ok: true as const, studentId: row.student_id };
  } catch (err) {
    console.error("[parentLoginWithTokenAction]", err);
    return {
      error: err instanceof Error ? err.message : "Parent login failed",
    };
  }
}

export async function parentLoginWithDetailsAction(input: {
  admission_no: string;
  guardian_phone: string;
}) {
  try {
    const admin = createAdminClient();
    const phone = input.guardian_phone.replace(/[^\d+]/g, "");
    const { data: students } = await admin
      .from("students")
      .select("id, guardian_phone, admission_no, status")
      .eq("admission_no", input.admission_no.trim())
      .eq("status", "active")
      .limit(20);

    const match = (students ?? []).find((s) => {
      const p = (s.guardian_phone || "").replace(/[^\d+]/g, "");
      return p === phone || p.endsWith(phone.slice(-9)) || phone.endsWith(p.slice(-9));
    });

    if (!match) return { error: "No matching student found" };

    const jar = await cookies();
    jar.set(PARENT_COOKIE, match.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return { ok: true as const, studentId: match.id };
  } catch (err) {
    console.error("[parentLoginWithDetailsAction]", err);
    return {
      error: err instanceof Error ? err.message : "Parent login failed",
    };
  }
}

export async function parentLogoutAction() {
  const jar = await cookies();
  jar.delete(PARENT_COOKIE);
  redirect("/parent");
}

export async function getParentStudentId() {
  const jar = await cookies();
  return jar.get(PARENT_COOKIE)?.value ?? null;
}
