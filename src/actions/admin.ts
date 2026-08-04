"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendCredentialsWhatsApp } from "@/lib/whatsapp";
import type { Database, UserRole } from "@/types/database";

type Sb = SupabaseClient<Database>;

const vendorSchema = z.object({
  name: z.string().min(2),
  address: z.string().optional(),
  contact_phone: z.string().optional(),
  whatsapp_number: z.string().min(8),
});

const branchSchema = z.object({
  vendor_id: z.string().uuid(),
  name: z.string().min(2),
  address: z.string().optional(),
  contact_phone: z.string().optional(),
});

const userSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(2),
  role: z.enum([
    "super_admin",
    "vendor_admin",
    "data_entry",
    "accountant",
    "principal",
  ]),
  vendor_id: z.string().uuid().nullable().optional(),
  branch_id: z.string().uuid().nullable().optional(),
  phone: z.string().optional(),
  whatsapp_number: z.string().min(8),
  temp_password: z.string().min(8).optional(),
});

async function requireSuperAdmin(): Promise<
  { ok: true; supabase: Sb } | { ok: false; error: string }
> {
  const auth = await requireManager();
  if (!auth.ok) return auth;
  if (auth.profile.role !== "super_admin") {
    return { ok: false, error: "Forbidden — super admin only." };
  }
  return { ok: true, supabase: auth.supabase };
}

async function requireManager(): Promise<
  | {
      ok: true;
      supabase: Sb;
      profile: { id: string; role: UserRole; vendor_id: string | null };
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized — please sign in again." };

  const { data: profile, error } = await supabase
    .from("app_users")
    .select("id, role, status, vendor_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (
    !profile ||
    profile.status !== "active" ||
    !["super_admin", "vendor_admin"].includes(profile.role)
  ) {
    return { ok: false, error: "Forbidden — admin access required." };
  }
  return {
    ok: true,
    supabase,
    profile: {
      id: profile.id,
      role: profile.role,
      vendor_id: profile.vendor_id,
    },
  };
}

function randomPassword() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function formatZodError(err: z.ZodError) {
  return err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
}

export async function createVendorAction(input: {
  name: string;
  address?: string;
  contact_phone?: string;
  whatsapp_number: string;
}) {
  try {
    const auth = await requireSuperAdmin();
    if (!auth.ok) return { error: auth.error };

    const parsed = vendorSchema.safeParse(input);
    if (!parsed.success) return { error: formatZodError(parsed.error) };

    const { error } = await auth.supabase.from("vendors").insert({
      name: parsed.data.name,
      address: parsed.data.address || null,
      contact_phone: parsed.data.contact_phone || null,
      whatsapp_number: parsed.data.whatsapp_number,
    });

    if (error) return { error: error.message };
    revalidatePath("/super-admin");
    return { ok: true as const };
  } catch (err) {
    console.error("[createVendorAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to create vendor",
    };
  }
}

export async function createBranchAction(input: {
  vendor_id: string;
  name: string;
  address?: string;
  contact_phone?: string;
}) {
  try {
    const auth = await requireManager();
    if (!auth.ok) return { error: auth.error };

    const parsed = branchSchema.safeParse(input);
    if (!parsed.success) return { error: formatZodError(parsed.error) };

    if (
      auth.profile.role === "vendor_admin" &&
      parsed.data.vendor_id !== auth.profile.vendor_id
    ) {
      return { error: "You can only create branches for your own madrasa." };
    }

    const { error } = await auth.supabase.from("branches").insert({
      vendor_id: parsed.data.vendor_id,
      name: parsed.data.name,
      address: parsed.data.address || null,
      contact_phone: parsed.data.contact_phone || null,
    });

    if (error) return { error: error.message };
    revalidatePath("/super-admin");
    revalidatePath("/vendor");
    return { ok: true as const };
  } catch (err) {
    console.error("[createBranchAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to create branch",
    };
  }
}

export async function createAppUserAction(input: {
  email: string;
  full_name: string;
  role: UserRole;
  vendor_id?: string | null;
  branch_id?: string | null;
  phone?: string;
  whatsapp_number: string;
  temp_password?: string;
}) {
  try {
    const auth = await requireManager();
    if (!auth.ok) return { error: auth.error };

    const parsed = userSchema.safeParse(input);
    if (!parsed.success) return { error: formatZodError(parsed.error) };

    if (auth.profile.role === "vendor_admin") {
      if (parsed.data.role === "super_admin") {
        return { error: "Vendor admins cannot create super admins." };
      }
      if (parsed.data.vendor_id !== auth.profile.vendor_id) {
        return { error: "You can only create users for your own madrasa." };
      }
    }

    if (
      !process.env.SUPABASE_SECRET_KEY &&
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return {
        error:
          "Missing SUPABASE_SECRET_KEY on the server. Add it in Vercel → Settings → Environment Variables (Supabase → API Keys → Secret key), then Redeploy.",
      };
    }

    let admin;
    try {
      admin = createAdminClient();
    } catch (err) {
      return {
        error:
          err instanceof Error
            ? err.message
            : "Admin client unavailable — set SUPABASE_SECRET_KEY",
      };
    }

    const tempPassword = parsed.data.temp_password || randomPassword();
    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email: parsed.data.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: parsed.data.full_name },
        app_metadata: { role: parsed.data.role },
      });

    if (authError || !authData.user) {
      return { error: authError?.message ?? "Failed to create auth user" };
    }

    const role = parsed.data.role;
    const vendorId =
      role === "super_admin"
        ? null
        : (parsed.data.vendor_id ??
          (auth.profile.role === "vendor_admin" ? auth.profile.vendor_id : null));

    const { error } = await admin.from("app_users").insert({
      id: authData.user.id,
      full_name: parsed.data.full_name,
      role,
      vendor_id: vendorId,
      branch_id: ["data_entry", "accountant", "principal"].includes(role)
        ? (parsed.data.branch_id ?? null)
        : null,
      phone: parsed.data.phone || null,
      whatsapp_number: parsed.data.whatsapp_number,
      status: "active",
    });

    if (error) {
      await admin.auth.admin.deleteUser(authData.user.id);
      return { error: error.message };
    }

    try {
      await sendCredentialsWhatsApp({
        to: parsed.data.whatsapp_number,
        fullName: parsed.data.full_name,
        email: parsed.data.email,
        tempPassword,
        vendorId,
      });
    } catch (waErr) {
      console.error("[whatsapp]", waErr);
    }

    revalidatePath("/super-admin");
    revalidatePath("/vendor");
    return {
      ok: true as const,
      credentials: { email: parsed.data.email, tempPassword },
    };
  } catch (err) {
    console.error("[createAppUserAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to create user",
    };
  }
}
