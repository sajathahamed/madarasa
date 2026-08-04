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
  accountant: "/branch/accountant",
  principal: "/branch/accountant",
};

export type LoginResult =
  | { error: string; redirectTo?: undefined }
  | { error?: undefined; redirectTo: string };

export async function loginAction(formData: FormData): Promise<LoginResult> {
  try {
    const parsed = loginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!parsed.success) {
      return { error: "Invalid email or password format" };
    }

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !(
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
    ) {
      return {
        error:
          "Server is missing Supabase env vars. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in Vercel.",
      };
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

    const { data: profile, error: profileError } = await supabase
      .from("app_users")
      .select("role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return { error: profileError.message };
    }

    if (!profile || profile.status !== "active") {
      await supabase.auth.signOut();
      return { error: "Account inactive or profile missing" };
    }

    // Return path for client navigation — do not call redirect() here.
    // redirect() inside a client-invoked action causes Vercel 500 / React #441.
    return { redirectTo: ROLE_HOME[profile.role] };
  } catch (err) {
    console.error("[loginAction]", err);
    return {
      error:
        err instanceof Error
          ? err.message
          : "Unexpected login error. Check server configuration.",
    };
  }
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
