/** Extract a PostgREST aggregate sum() value from a select result row. */
export function aggregateSum(
  row: { sum?: number | string | null } | null | undefined,
): number {
  if (!row || row.sum == null) return 0;
  const n = Number(row.sum);
  return Number.isFinite(n) ? n : 0;
}
