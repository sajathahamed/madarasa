"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

async function requireActiveUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" as const };

  const { data: profile } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.status !== "active") {
    return { error: "Unauthorized" as const };
  }
  return { supabase, profile };
}

export async function setUserStatusAction(input: {
  userId: string;
  status: "active" | "inactive";
}) {
  try {
    const auth = await requireActiveUser();
    if ("error" in auth) return { error: auth.error };

    const { data: target } = await auth.supabase
      .from("app_users")
      .select("id, vendor_id, role")
      .eq("id", input.userId)
      .maybeSingle();

    if (!target) return { error: "User not found" };

    const isSuper = auth.profile.role === "super_admin";
    const isVendorAdmin =
      auth.profile.role === "vendor_admin" &&
      target.vendor_id === auth.profile.vendor_id &&
      target.role !== "super_admin";

    if (!isSuper && !isVendorAdmin) {
      return { error: "Forbidden" };
    }

    const { error } = await auth.supabase
      .from("app_users")
      .update({ status: input.status })
      .eq("id", input.userId);

    if (error) return { error: error.message };
    revalidatePath("/super-admin");
    revalidatePath("/vendor");
    revalidatePath("/vendor/staff");
    return { ok: true as const };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to update user",
    };
  }
}

export async function setVendorStatusAction(input: {
  vendorId: string;
  status: "active" | "suspended";
}) {
  try {
    const auth = await requireActiveUser();
    if ("error" in auth) return { error: auth.error };
    if (auth.profile.role !== "super_admin") return { error: "Forbidden" };

    const { error } = await auth.supabase
      .from("vendors")
      .update({ status: input.status })
      .eq("id", input.vendorId);

    if (error) return { error: error.message };
    revalidatePath("/super-admin");
    return { ok: true as const };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to update vendor",
    };
  }
}
