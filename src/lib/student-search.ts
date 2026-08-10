export type StudentSearchFields = {
  full_name?: string | null;
  admission_no?: string | null;
  guardian_phone?: string | null;
  student_name?: string | null;
};

/** Match name, admission ID, or phone (case-insensitive). */
export function matchesStudentQuery(
  row: StudentSearchFields,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const name = (row.full_name || row.student_name || "").toLowerCase();
  const admission = (row.admission_no || "").toLowerCase();
  const phone = row.guardian_phone || "";
  return (
    name.includes(needle) ||
    admission.includes(needle) ||
    phone.includes(needle)
  );
}
