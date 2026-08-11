"use server";

import { z } from "zod";

import {
  canEnrollStudents,
  canManageClasses,
  canMarkAttendance,
  requireProfile,
} from "@/lib/auth/session";
import { notifyAbsenceAction } from "@/actions/students";

const classSchema = z
  .object({
    vendor_id: z.string().uuid(),
    branch_id: z.string().uuid(),
    name: z.string().optional(),
    section: z.enum(["hifz", "sariya"]),
    grade: z.coerce.number().int().min(1).max(7).optional().nullable(),
    schedule_note: z.string().optional(),
    academic_year_id: z.string().uuid().optional().nullable(),
    teacher_id: z.string().uuid().optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.section === "hifz" && val.grade != null) {
      ctx.addIssue({
        code: "custom",
        message: "Hifz has no grade",
        path: ["grade"],
      });
    }
    if (val.section === "sariya" && (val.grade == null || val.grade < 1 || val.grade > 7)) {
      ctx.addIssue({
        code: "custom",
        message: "Sariya requires grade 1–7",
        path: ["grade"],
      });
    }
  });

export async function createClassAction(input: z.infer<typeof classSchema>) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (!canManageClasses(auth.profile.role)) return { error: "Forbidden" };

    const parsed = classSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues.map((i) => i.message).join("; ") };
    }

    const section = parsed.data.section;
    const grade = section === "hifz" ? null : parsed.data.grade ?? null;
    const name =
      parsed.data.name?.trim() ||
      (section === "hifz" ? "Hifz" : `Sariya ${grade}`);

    const { data, error } = await auth.supabase
      .from("classes")
      .insert({
        vendor_id: parsed.data.vendor_id,
        branch_id: parsed.data.branch_id,
        name,
        section,
        grade,
        schedule_note: parsed.data.schedule_note || null,
        academic_year_id: parsed.data.academic_year_id || null,
        teacher_id: parsed.data.teacher_id || null,
      })
      .select("id")
      .maybeSingle();

    if (error) return { error: error.message };
    return { ok: true as const, id: data?.id };
  } catch (err) {
    console.error("[createClassAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to create class",
    };
  }
}

const enrollSchema = z.object({
  class_id: z.string().uuid(),
  student_id: z.string().uuid(),
});

export async function enrollStudentAction(input: z.infer<typeof enrollSchema>) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (!canEnrollStudents(auth.profile.role)) return { error: "Forbidden" };

    const parsed = enrollSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues.map((i) => i.message).join("; ") };
    }

    // One active section/class per student: leave other enrollments.
    await auth.supabase
      .from("class_enrollments")
      .update({ is_active: false, left_at: new Date().toISOString().slice(0, 10) })
      .eq("student_id", parsed.data.student_id)
      .eq("is_active", true)
      .neq("class_id", parsed.data.class_id);

    const { error } = await auth.supabase.from("class_enrollments").upsert(
      {
        class_id: parsed.data.class_id,
        student_id: parsed.data.student_id,
        is_active: true,
        left_at: null,
      },
      { onConflict: "class_id,student_id" },
    );

    if (error) return { error: error.message };
    return { ok: true as const };
  } catch (err) {
    console.error("[enrollStudentAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to enroll",
    };
  }
}

const attendanceSchema = z.object({
  class_id: z.string().uuid(),
  session_date: z.string().min(8),
  records: z.array(
    z.object({
      student_id: z.string().uuid(),
      status: z.enum(["present", "absent", "late"]),
      note: z.string().optional(),
    }),
  ),
  notify_absences: z.boolean().optional().default(true),
});

export async function saveAttendanceAction(
  input: z.infer<typeof attendanceSchema>,
) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (!canMarkAttendance(auth.profile.role)) return { error: "Forbidden" };

    const parsed = attendanceSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues.map((i) => i.message).join("; ") };
    }

    const { data: klass } = await auth.supabase
      .from("classes")
      .select("id, vendor_id, branch_id")
      .eq("id", parsed.data.class_id)
      .maybeSingle();

    if (!klass) return { error: "Class not found" };

    const { data: session, error: sessionError } = await auth.supabase
      .from("attendance_sessions")
      .upsert(
        {
          vendor_id: klass.vendor_id,
          branch_id: klass.branch_id,
          class_id: klass.id,
          session_date: parsed.data.session_date,
          marked_by: auth.user.id,
        },
        { onConflict: "class_id,session_date" },
      )
      .select("id")
      .maybeSingle();

    if (sessionError || !session) {
      return { error: sessionError?.message ?? "Session save failed" };
    }

    // clear previous marks for this session then insert
    await auth.supabase
      .from("attendance_records")
      .delete()
      .eq("session_id", session.id);

    const { error: recError } = await auth.supabase
      .from("attendance_records")
      .insert(
        parsed.data.records.map((r) => ({
          session_id: session.id,
          student_id: r.student_id,
          status: r.status,
          note: r.note || null,
        })),
      );

    if (recError) return { error: recError.message };

    if (parsed.data.notify_absences !== false) {
      for (const r of parsed.data.records) {
        if (r.status === "absent" || r.status === "late") {
          await notifyAbsenceAction({
            studentId: r.student_id,
            sessionDate: parsed.data.session_date,
            status: r.status,
          });
        }
      }
    }

    return { ok: true as const, sessionId: session.id };
  } catch (err) {
    console.error("[saveAttendanceAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to save attendance",
    };
  }
}

const yearSchema = z.object({
  vendor_id: z.string().uuid(),
  name: z.string().min(2),
  starts_on: z.string().min(8),
  ends_on: z.string().min(8),
  is_current: z.boolean().optional().default(true),
});

export async function createAcademicYearAction(
  input: z.infer<typeof yearSchema>,
) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (!["super_admin", "vendor_admin"].includes(auth.profile.role)) {
      return { error: "Forbidden" };
    }

    const parsed = yearSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues.map((i) => i.message).join("; ") };
    }

    if (parsed.data.is_current) {
      await auth.supabase
        .from("academic_years")
        .update({ is_current: false })
        .eq("vendor_id", parsed.data.vendor_id);
    }

    const { error } = await auth.supabase.from("academic_years").insert({
      vendor_id: parsed.data.vendor_id,
      name: parsed.data.name,
      starts_on: parsed.data.starts_on,
      ends_on: parsed.data.ends_on,
      is_current: parsed.data.is_current ?? true,
    });

    if (error) return { error: error.message };
    return { ok: true as const };
  } catch (err) {
    console.error("[createAcademicYearAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to create year",
    };
  }
}
