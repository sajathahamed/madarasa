"use server";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendCredentialsWhatsApp } from "@/lib/whatsapp";
import type { UserRole } from "@/types/database";

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

async function requireSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "super_admin") {
    throw new Error("Forbidden");
  }
  return { supabase, user, profile };
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

export async function createVendorAction(input: z.infer<typeof vendorSchema>) {
  await requireSuperAdmin();
  const parsed = vendorSchema.parse(input);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vendors")
    .insert({
      name: parsed.name,
      address: parsed.address || null,
      contact_phone: parsed.contact_phone || null,
      whatsapp_number: parsed.whatsapp_number,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}

export async function createBranchAction(input: z.infer<typeof branchSchema>) {
  await requireSuperAdmin();
  const parsed = branchSchema.parse(input);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("branches")
    .insert({
      vendor_id: parsed.vendor_id,
      name: parsed.name,
      address: parsed.address || null,
      contact_phone: parsed.contact_phone || null,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}

export async function createAppUserAction(input: z.infer<typeof userSchema>) {
  await requireSuperAdmin();
  const parsed = userSchema.parse(input);
  const tempPassword = parsed.temp_password || randomPassword();
  const admin = createAdminClient();

  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email: parsed.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: parsed.full_name },
      app_metadata: { role: parsed.role },
    });

  if (authError || !authData.user) {
    return { error: authError?.message ?? "Failed to create auth user" };
  }

  const role = parsed.role as UserRole;
  const { data, error } = await admin
    .from("app_users")
    .insert({
      id: authData.user.id,
      full_name: parsed.full_name,
      role,
      vendor_id: role === "super_admin" ? null : (parsed.vendor_id ?? null),
      branch_id: ["data_entry", "accountant", "principal"].includes(role)
        ? (parsed.branch_id ?? null)
        : null,
      phone: parsed.phone || null,
      whatsapp_number: parsed.whatsapp_number,
      status: "active",
    })
    .select()
    .single();

  if (error) {
    await admin.auth.admin.deleteUser(authData.user.id);
    return { error: error.message };
  }

  await sendCredentialsWhatsApp({
    to: parsed.whatsapp_number,
    fullName: parsed.full_name,
    email: parsed.email,
    tempPassword,
    vendorId: parsed.vendor_id,
  });

  return {
    data,
    credentials: { email: parsed.email, tempPassword },
  };
}
