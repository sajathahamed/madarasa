export const currency = process.env.NEXT_PUBLIC_CURRENCY ?? "LKR";

/** Default monthly fee used for pending-months display (Markaz / Excel imports). */
export const DEFAULT_MONTHLY_FEE = 12000;

export function formatMoney(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return `${currency} ${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Convert an outstanding amount into pending months for display.
 * e.g. 78000 / 12000 → "6.5 mo"; 24000 → "2 months"; 0 → "0 months"
 */
export function pendingMonthsFromAmount(
  amount: number | string | null | undefined,
  monthly: number = DEFAULT_MONTHLY_FEE,
): number {
  const bal = Number(amount ?? 0);
  if (!Number.isFinite(bal) || bal <= 0 || !monthly || monthly <= 0) return 0;
  // Keep up to 2 decimal places to avoid float noise (e.g. 78000/12000)
  return Math.round((bal / monthly) * 100) / 100;
}

export function formatPendingMonths(
  amount: number | string | null | undefined,
  monthly: number = DEFAULT_MONTHLY_FEE,
): string {
  const months = pendingMonthsFromAmount(amount, monthly);
  if (months === 0) return "0 months";
  if (Number.isInteger(months)) {
    return months === 1 ? "1 month" : `${months} months`;
  }
  // Fractional (e.g. 6.5) — compact label
  return `${months} mo`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatRole(role: string) {
  return role.replaceAll("_", " ");
}
