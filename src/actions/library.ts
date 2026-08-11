"use server";

import { z } from "zod";

import { canManageLibrary, requireProfile } from "@/lib/auth/session";
import type { AuthOk } from "@/lib/auth/session";

async function resolveBookTypeId(
  auth: AuthOk,
  opts: {
    vendor_id: string;
    branch_id: string;
    type_id?: string | null;
    new_type_name?: string | null;
  },
): Promise<{ typeId: string | null; error?: string }> {
  const newName = opts.new_type_name?.trim();
  if (newName) {
    const { data: existing } = await auth.supabase
      .from("library_book_types")
      .select("id")
      .eq("vendor_id", opts.vendor_id)
      .eq("branch_id", opts.branch_id)
      .ilike("name", newName)
      .maybeSingle();

    if (existing) return { typeId: existing.id };

    const { data: created, error } = await auth.supabase
      .from("library_book_types")
      .insert({
        vendor_id: opts.vendor_id,
        branch_id: opts.branch_id,
        name: newName,
        created_by: auth.user.id,
      })
      .select("id")
      .maybeSingle();

    if (error) return { typeId: null, error: error.message };
    return { typeId: created?.id ?? null };
  }

  if (opts.type_id) {
    const { data: t } = await auth.supabase
      .from("library_book_types")
      .select("id")
      .eq("id", opts.type_id)
      .eq("vendor_id", opts.vendor_id)
      .maybeSingle();
    if (!t) return { typeId: null, error: "Book type not found" };
    return { typeId: t.id };
  }

  return { typeId: null };
}

const addTypeSchema = z.object({
  vendor_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  name: z.string().min(1),
});

export async function addLibraryBookTypeAction(
  input: z.infer<typeof addTypeSchema>,
) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (!canManageLibrary(auth.profile.role)) return { error: "Forbidden" };

    const parsed = addTypeSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues.map((i) => i.message).join("; ") };
    }

    const name = parsed.data.name.trim();
    const resolved = await resolveBookTypeId(auth, {
      vendor_id: parsed.data.vendor_id,
      branch_id: parsed.data.branch_id,
      new_type_name: name,
    });
    if (resolved.error) return { error: resolved.error };
    return { ok: true as const, id: resolved.typeId };
  } catch (err) {
    console.error("[addLibraryBookTypeAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to add type",
    };
  }
}

const addBookSchema = z.object({
  vendor_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  title: z.string().min(1),
  qitab_id: z.string().min(1),
  author: z.string().optional(),
  type_id: z.string().uuid().optional().nullable(),
  new_type_name: z.string().optional().nullable(),
  copies_total: z.coerce.number().int().min(1).default(1),
  notes: z.string().optional(),
});

export async function addLibraryBookAction(
  input: z.infer<typeof addBookSchema>,
) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (!canManageLibrary(auth.profile.role)) return { error: "Forbidden" };

    const parsed = addBookSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues.map((i) => i.message).join("; ") };
    }

    const qitabId = parsed.data.qitab_id.trim();
    if (!qitabId) return { error: "Qitab ID is required" };

    const typeRes = await resolveBookTypeId(auth, {
      vendor_id: parsed.data.vendor_id,
      branch_id: parsed.data.branch_id,
      type_id: parsed.data.type_id,
      new_type_name: parsed.data.new_type_name,
    });
    if (typeRes.error) return { error: typeRes.error };

    const { data, error } = await auth.supabase
      .from("library_books")
      .insert({
        vendor_id: parsed.data.vendor_id,
        branch_id: parsed.data.branch_id,
        title: parsed.data.title.trim(),
        qitab_id: qitabId,
        author: parsed.data.author?.trim() || null,
        type_id: typeRes.typeId,
        copies_total: parsed.data.copies_total,
        notes: parsed.data.notes?.trim() || null,
        created_by: auth.user.id,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return { error: "Qitab ID already exists for this vendor" };
      }
      return { error: error.message };
    }
    return { ok: true as const, id: data?.id };
  } catch (err) {
    console.error("[addLibraryBookAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to add book",
    };
  }
}

const borrowSchema = z.object({
  book_id: z.string().uuid(),
  student_id: z.string().uuid().optional().nullable(),
  staff_id: z.string().uuid().optional().nullable(),
  due_at: z.string().optional().nullable(),
  notes: z.string().optional(),
});

export async function borrowLibraryBookAction(
  input: z.infer<typeof borrowSchema>,
) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (!canManageLibrary(auth.profile.role)) return { error: "Forbidden" };

    const parsed = borrowSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues.map((i) => i.message).join("; ") };
    }

    const studentId = parsed.data.student_id || null;
    const staffId = parsed.data.staff_id || null;
    if ((!studentId && !staffId) || (studentId && staffId)) {
      return { error: "Choose either a student or a staff member" };
    }

    const { data: book } = await auth.supabase
      .from("library_books")
      .select(
        "id, vendor_id, branch_id, copies_total, is_active, title, qitab_id, author, type_id",
      )
      .eq("id", parsed.data.book_id)
      .maybeSingle();

    if (!book || !book.is_active) return { error: "Book not found" };

    if (studentId) {
      const { data: student } = await auth.supabase
        .from("students")
        .select("id, vendor_id, branch_id, status")
        .eq("id", studentId)
        .maybeSingle();

      if (!student || student.status !== "active") {
        return { error: "Student not found" };
      }
      if (student.vendor_id !== book.vendor_id) {
        return { error: "Student and book must be same vendor" };
      }
    } else if (staffId) {
      const { data: staff } = await auth.supabase
        .from("staff_members")
        .select("id, vendor_id, branch_id, status, full_name")
        .eq("id", staffId)
        .maybeSingle();

      if (!staff || staff.status !== "active") {
        return { error: "Staff not found or not active" };
      }
      if (staff.vendor_id !== book.vendor_id) {
        return { error: "Staff and book must be same vendor" };
      }
    }

    const { count: outCount } = await auth.supabase
      .from("library_loans")
      .select("id", { count: "exact", head: true })
      .eq("book_id", book.id)
      .is("returned_at", null);

    const available = book.copies_total - (outCount ?? 0);
    if (available <= 0) {
      return {
        error: `"${book.title}" (${book.qitab_id}) has no copies available`,
      };
    }

    const { error } = await auth.supabase.from("library_loans").insert({
      vendor_id: book.vendor_id,
      branch_id: book.branch_id,
      book_id: book.id,
      student_id: studentId,
      staff_id: staffId,
      due_at: parsed.data.due_at || null,
      notes: parsed.data.notes?.trim() || null,
      borrowed_by: auth.user.id,
    });

    if (error) return { error: error.message };
    return { ok: true as const };
  } catch (err) {
    console.error("[borrowLibraryBookAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to borrow book",
    };
  }
}

const returnSchema = z.object({
  loan_id: z.string().uuid(),
});

export async function returnLibraryBookAction(
  input: z.infer<typeof returnSchema>,
) {
  try {
    const auth = await requireProfile();
    if ("error" in auth) return { error: auth.error };
    if (!canManageLibrary(auth.profile.role)) return { error: "Forbidden" };

    const parsed = returnSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues.map((i) => i.message).join("; ") };
    }

    const { data: loan } = await auth.supabase
      .from("library_loans")
      .select("id, returned_at")
      .eq("id", parsed.data.loan_id)
      .maybeSingle();

    if (!loan) return { error: "Loan not found" };
    if (loan.returned_at) return { error: "Already returned" };

    const { error } = await auth.supabase
      .from("library_loans")
      .update({ returned_at: new Date().toISOString() })
      .eq("id", loan.id)
      .is("returned_at", null);

    if (error) return { error: error.message };
    return { ok: true as const };
  } catch (err) {
    console.error("[returnLibraryBookAction]", err);
    return {
      error: err instanceof Error ? err.message : "Failed to return book",
    };
  }
}
