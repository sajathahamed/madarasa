import { LibraryClient } from "@/components/library/library-client";
import { canManageLibrary } from "@/lib/auth/session";
import { OpsShell } from "@/components/layout/ops-shell";
import { requireOpsContext } from "@/lib/ops-page";

export default async function LibraryPage() {
  const { supabase, profile } = await requireOpsContext();

  let booksQ = supabase
    .from("library_books")
    .select(
      "id, title, qitab_id, author, type_id, copies_total, notes, is_active",
    )
    .eq("is_active", true)
    .order("title");
  let typesQ = supabase
    .from("library_book_types")
    .select("id, name")
    .order("name");
  let studentsQ = supabase
    .from("students")
    .select("id, full_name, admission_no")
    .eq("status", "active")
    .order("full_name")
    .limit(400);
  let staffQ = supabase
    .from("staff_members")
    .select("id, full_name, staff_code, role_title, phone")
    .eq("status", "active")
    .order("full_name")
    .limit(400);
  let loansQ = supabase
    .from("library_loans")
    .select(
      "id, book_id, student_id, staff_id, borrowed_at, returned_at, notes",
    )
    .order("borrowed_at", { ascending: false })
    .limit(200);
  let branchesQ = supabase
    .from("branches")
    .select("id, name, vendor_id")
    .order("name");

  if (profile.vendor_id) {
    booksQ = booksQ.eq("vendor_id", profile.vendor_id);
    typesQ = typesQ.eq("vendor_id", profile.vendor_id);
    studentsQ = studentsQ.eq("vendor_id", profile.vendor_id);
    staffQ = staffQ.eq("vendor_id", profile.vendor_id);
    loansQ = loansQ.eq("vendor_id", profile.vendor_id);
    branchesQ = branchesQ.eq("vendor_id", profile.vendor_id);
  }
  if (profile.branch_id) {
    booksQ = booksQ.eq("branch_id", profile.branch_id);
    typesQ = typesQ.eq("branch_id", profile.branch_id);
    studentsQ = studentsQ.eq("branch_id", profile.branch_id);
    staffQ = staffQ.eq("branch_id", profile.branch_id);
    loansQ = loansQ.eq("branch_id", profile.branch_id);
  }

  const [
    { data: books },
    { data: bookTypes },
    { data: students },
    { data: staff },
    { data: loans },
    { data: branches },
  ] = await Promise.all([
    booksQ,
    typesQ,
    studentsQ,
    staffQ,
    loansQ,
    branchesQ,
  ]);

  const typeById = new Map((bookTypes ?? []).map((t) => [t.id, t.name]));
  const activeOutByBook = new Map<string, number>();
  for (const loan of loans ?? []) {
    if (!loan.returned_at) {
      activeOutByBook.set(
        loan.book_id,
        (activeOutByBook.get(loan.book_id) ?? 0) + 1,
      );
    }
  }

  const studentIds = [
    ...new Set(
      (loans ?? []).map((l) => l.student_id).filter((id): id is string => !!id),
    ),
  ];
  const staffIds = [
    ...new Set(
      (loans ?? []).map((l) => l.staff_id).filter((id): id is string => !!id),
    ),
  ];
  const [{ data: loanStudents }, { data: loanStaff }] = await Promise.all([
    studentIds.length > 0
      ? supabase
          .from("students")
          .select("id, full_name, admission_no")
          .in("id", studentIds)
      : Promise.resolve({
          data: [] as { id: string; full_name: string; admission_no: string }[],
        }),
    staffIds.length > 0
      ? supabase
          .from("staff_members")
          .select("id, full_name, staff_code, role_title")
          .in("id", staffIds)
      : Promise.resolve({
          data: [] as {
            id: string;
            full_name: string;
            staff_code: string | null;
            role_title: string | null;
          }[],
        }),
  ]);

  const studentById = new Map((loanStudents ?? []).map((s) => [s.id, s]));
  const staffById = new Map((loanStaff ?? []).map((s) => [s.id, s]));
  const bookById = new Map((books ?? []).map((b) => [b.id, b]));

  const missingBookIds = [
    ...new Set((loans ?? []).map((l) => l.book_id)),
  ].filter((id) => !bookById.has(id));
  if (missingBookIds.length > 0) {
    const { data: extraBooks } = await supabase
      .from("library_books")
      .select(
        "id, title, qitab_id, author, type_id, copies_total, notes, is_active",
      )
      .in("id", missingBookIds);
    for (const b of extraBooks ?? []) bookById.set(b.id, b);
  }

  const missingTypeIds = [
    ...new Set(
      [...bookById.values()]
        .map((b) => b.type_id)
        .filter((id): id is string => !!id && !typeById.has(id)),
    ),
  ];
  if (missingTypeIds.length > 0) {
    const { data: extraTypes } = await supabase
      .from("library_book_types")
      .select("id, name")
      .in("id", missingTypeIds);
    for (const t of extraTypes ?? []) typeById.set(t.id, t.name);
  }

  const mappedLoans = (loans ?? []).map((l) => {
    const book = bookById.get(l.book_id);
    const st = l.student_id ? studentById.get(l.student_id) : null;
    const staffMember = l.staff_id ? staffById.get(l.staff_id) : null;
    return {
      id: l.id,
      book_id: l.book_id,
      book_title: book?.title ?? "Unknown book",
      book_qitab_id: book?.qitab_id ?? "—",
      book_author: book?.author ?? null,
      book_type_name: book?.type_id ? typeById.get(book.type_id) ?? null : null,
      student_id: l.student_id,
      staff_id: l.staff_id,
      borrower_kind: l.staff_id ? ("staff" as const) : ("student" as const),
      borrower_name:
        staffMember?.full_name ?? st?.full_name ?? "Unknown borrower",
      borrower_code:
        staffMember?.staff_code ?? st?.admission_no ?? "—",
      borrowed_at: l.borrowed_at,
      returned_at: l.returned_at,
      notes: l.notes,
    };
  });

  const vendorId = profile.vendor_id || branches?.[0]?.vendor_id || "";
  const branchId = profile.branch_id || branches?.[0]?.id || "";

  return (
    <OpsShell profile={profile} title="Library">
      <LibraryClient
        vendorId={vendorId}
        branchId={branchId}
        bookTypes={bookTypes ?? []}
        books={(books ?? []).map((b) => ({
          id: b.id,
          title: b.title,
          qitab_id: b.qitab_id,
          author: b.author,
          type_id: b.type_id,
          type_name: b.type_id ? typeById.get(b.type_id) ?? null : null,
          copies_total: b.copies_total,
          available: Math.max(
            0,
            b.copies_total - (activeOutByBook.get(b.id) ?? 0),
          ),
          notes: b.notes,
        }))}
        students={students ?? []}
        staff={(staff ?? []).map((s) => ({
          id: s.id,
          full_name: s.full_name,
          staff_code: s.staff_code,
          role_title: s.role_title,
        }))}
        activeLoans={mappedLoans.filter((l) => !l.returned_at)}
        returnedLoans={mappedLoans.filter((l) => !!l.returned_at)}
        canManage={canManageLibrary(profile.role)}
      />
    </OpsShell>
  );
}
