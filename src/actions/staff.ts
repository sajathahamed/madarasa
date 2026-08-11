"use server";

import { z } from "zod";

import { canManageLibrary, requireProfile } from "@/lib/auth/session";

const staffSchema = z.object({
  vendor_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  full_name: z.string().min(2),
  staff_code: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  role_title: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  status: z.enum(["active", "left"]).optional().default("active"),
  notes: z.string().optional().nullable(),
});

export async function createStaffMemberAction(
  input: z.infer<typeof staffSchema>,
) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (!canManageLibrary(auth.profile.role)) return { error: "Forbidden" };

    const parsed = staffSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues.map((i) => i.message).join("; ") };
    }

    const { error, data } = await auth.supabase
      .from("staff_members")
      .insert({
        vendor_id: parsed.data.vendor_id,
        branch_id: parsed.data.branch_id,
        full_name: parsed.data.full_name.trim(),
        staff_code: parsed.data.staff_code?.trim() || null,
        phone: parsed.data.phone?.trim() || null,
        email: parsed.data.email?.trim() || null,
        role_title: parsed.data.role_title?.trim() || null,
        address: parsed.data.address?.trim() || null,
        status: parsed.data.status ?? "active",
        notes: parsed.data.notes?.trim() || null,
        created_by: auth.user.id,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return { error: "Staff code already exists for this vendor" };
      }
      return { error: error.message };
    }
    return { ok: true as const, id: data?.id };
  } catch (err) {
    console.error("[createStaffMemberAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to create staff",
    };
  }
}

const updateStaffSchema = staffSchema
  .omit({ vendor_id: true, branch_id: true })
  .extend({ id: z.string().uuid() });

export async function updateStaffMemberAction(
  input: z.infer<typeof updateStaffSchema>,
) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (!canManageLibrary(auth.profile.role)) return { error: "Forbidden" };

    const parsed = updateStaffSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues.map((i) => i.message).join("; ") };
    }

    const { id, ...fields } = parsed.data;
    const { error } = await auth.supabase
      .from("staff_members")
      .update({
        full_name: fields.full_name.trim(),
        staff_code: fields.staff_code?.trim() || null,
        phone: fields.phone?.trim() || null,
        email: fields.email?.trim() || null,
        role_title: fields.role_title?.trim() || null,
        address: fields.address?.trim() || null,
        status: fields.status ?? "active",
        notes: fields.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      if (error.code === "23505") {
        return { error: "Staff code already exists for this vendor" };
      }
      return { error: error.message };
    }
    return { ok: true as const };
  } catch (err) {
    console.error("[updateStaffMemberAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to update staff",
    };
  }
}
