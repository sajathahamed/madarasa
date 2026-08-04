"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const ROLE_HOME: Record<UserRole, string> = {
  super_admin: "/super-admin",
  vendor_admin: "/vendor",
  data_entry: "/branch",
  accountant: "/branch",
  principal: "/branch",
};

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Invalid email or password format" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: error.message };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Login failed" };

  const { data: profile } = await supabase
    .from("app_users")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.status !== "active") {
    await supabase.auth.signOut();
    return { error: "Account inactive or profile missing" };
  }

  redirect(ROLE_HOME[profile.role]);
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
