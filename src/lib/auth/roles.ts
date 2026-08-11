/** Pure role helpers — safe for client + server. */

/** Vendor day-to-day uses Admin + Data entry; legacy roles kept for DB enum compat. */
export function roleLabel(role: string | null | undefined) {
  switch (role) {
    case "vendor_admin":
      return "Admin";
    case "data_entry":
      return "Data entry";
    case "super_admin":
      return "Platform admin";
    case "accountant":
      return "Accountant (legacy)";
    case "principal":
      return "Principal (legacy)";
    default:
      return (role ?? "unknown").replaceAll("_", " ");
  }
}
