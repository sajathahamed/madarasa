"use server";

import { z } from "zod";

import { canLogProgress, requireProfile } from "@/lib/auth/session";
import { sendProgressNoteWhatsApp } from "@/lib/whatsapp";

const progressSchema = z.object({
  student_id: z.string().uuid(),
  class_id: z.string().uuid().optional().nullable(),
  stream: z.enum(["qaida", "nazirah", "hifz"]),
  hifz_component: z.enum(["sabaq", "sabqi", "manzil", "juz"]).optional().nullable(),
  lesson_label: z.string().min(1),
  pages_or_ayah: z.string().optional().nullable(),
  quality_note: z.string().optional().nullable(),
  logged_on: z.string().optional(),
  notify_parent: z.boolean().optional().default(false),
});

export async function logIslamicProgressAction(
  input: z.infer<typeof progressSchema>,
) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (!canLogProgress(auth.profile.role)) return { error: "Forbidden" };

    const parsed = progressSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues.map((i) => i.message).join("; ") };
    }

    const { data: student } = await auth.supabase
      .from("students")
      .select("id, vendor_id, branch_id, full_name, guardian_phone")
      .eq("id", parsed.data.student_id)
      .maybeSingle();

    if (!student) return { error: "Student not found" };

    const { error } = await auth.supabase.from("islamic_progress_logs").insert({
      vendor_id: student.vendor_id,
      branch_id: student.branch_id,
      student_id: student.id,
      class_id: parsed.data.class_id || null,
      stream: parsed.data.stream,
      hifz_component:
        parsed.data.stream === "hifz"
          ? parsed.data.hifz_component || "sabaq"
          : null,
      lesson_label: parsed.data.lesson_label,
      pages_or_ayah: parsed.data.pages_or_ayah || null,
      quality_note: parsed.data.quality_note || null,
      logged_by: auth.user.id,
      logged_on: parsed.data.logged_on || new Date().toISOString().slice(0, 10),
    });

    if (error) return { error: error.message };

    if (parsed.data.notify_parent && student.guardian_phone) {
      await sendProgressNoteWhatsApp({
        to: student.guardian_phone,
        studentName: student.full_name,
        stream: parsed.data.stream,
        lesson: parsed.data.lesson_label,
        note: parsed.data.quality_note || "",
        vendorId: student.vendor_id,
        studentId: student.id,
      });
    }

    return { ok: true as const };
  } catch (err) {
    console.error("[logIslamicProgressAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to log progress",
    };
  }
}
