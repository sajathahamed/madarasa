import type { AcademicSection } from "@/types/database";

export const SARIYA_GRADES = [1, 2, 3, 4, 5, 6, 7] as const;

export type SariyaGrade = (typeof SARIYA_GRADES)[number];

export function classDisplayName(
  section: AcademicSection | null | undefined,
  grade: number | null | undefined,
  fallbackName?: string | null,
) {
  if (section === "hifz") return "Hifz";
  if (section === "sariya" && grade != null) return `Sariya ${grade}`;
  return fallbackName?.trim() || "Unassigned";
}

export function sectionLabel(
  section: AcademicSection | null | undefined,
  grade?: number | null,
) {
  if (section === "hifz") return "Hifz";
  if (section === "sariya") {
    return grade != null ? `Sariya ${grade}` : "Sariya";
  }
  return "—";
}

export function sectionBadgeValue(
  section: AcademicSection | null | undefined,
): string {
  if (section === "hifz") return "hifz";
  if (section === "sariya") return "sariya";
  return "unassigned";
}

/** Canonical class options for forms (Hifz + Sariya 1–7). */
export function academicClassOptions() {
  return [
    { key: "hifz", label: "Hifz", section: "hifz" as const, grade: null },
    ...SARIYA_GRADES.map((g) => ({
      key: `sariya-${g}`,
      label: `Sariya ${g}`,
      section: "sariya" as const,
      grade: g,
    })),
  ];
}

export function daysBorrowed(borrowedAt: string, returnedAt?: string | null) {
  const start = new Date(borrowedAt).getTime();
  const end = returnedAt ? new Date(returnedAt).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
}
