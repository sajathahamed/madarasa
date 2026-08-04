export const currency = process.env.NEXT_PUBLIC_CURRENCY ?? "LKR";

export function formatMoney(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return `${currency} ${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
