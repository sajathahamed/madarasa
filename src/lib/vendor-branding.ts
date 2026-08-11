/**
 * Per-vendor UI branding (logo + bilingual display names).
 * Operational vendor.name stays as the DB key (e.g. "eravur markaz").
 */

export type VendorBranding = {
  logoUrl: string;
  nameEn: string;
  nameAr: string;
};

const BY_VENDOR_NAME: Record<string, VendorBranding> = {
  "eravur markaz": {
    logoUrl: "/markas.jpeg",
    nameEn: "AL-BAQIYATHUS SALIHATH ARABIC COLLEGE",
    nameAr: "\u0643\u0644\u064A\u0629 \u0627\u0644\u0628\u0627\u0642\u064A\u0627\u062A \u0627\u0644\u0635\u0627\u0644\u062D\u0627\u062A \u0627\u0644\u0639\u0631\u0628\u064A\u0629",
  },
};

export function brandingForVendorName(
  name: string | null | undefined,
): VendorBranding | null {
  if (!name) return null;
  return BY_VENDOR_NAME[name.trim().toLowerCase()] ?? null;
}

export function displayVendorName(
  vendorName: string | null | undefined,
): string {
  return brandingForVendorName(vendorName)?.nameEn ?? vendorName ?? "Madarasa";
}
