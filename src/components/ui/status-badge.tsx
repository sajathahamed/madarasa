import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-900",
  inactive: "bg-zinc-200 text-zinc-700",
  suspended: "bg-amber-100 text-amber-900",
  left: "bg-zinc-200 text-zinc-700",
  graduated: "bg-teal-100 text-teal-900",
  unpaid: "bg-rose-100 text-rose-900",
  partial: "bg-amber-100 text-amber-900",
  paid: "bg-emerald-100 text-emerald-900",
  pending_accountant: "bg-sky-100 text-sky-900",
  pending_principal: "bg-violet-100 text-violet-900",
  approved: "bg-emerald-100 text-emerald-900",
  rejected: "bg-rose-100 text-rose-900",
  super_admin: "bg-[#0b3d2e]/10 text-[#0b3d2e]",
  vendor_admin: "bg-teal-100 text-teal-900",
  data_entry: "bg-slate-100 text-slate-800",
  accountant: "bg-indigo-100 text-indigo-900",
  principal: "bg-orange-100 text-orange-900",
};

export function StatusBadge({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-xs capitalize",
        STYLES[value] ?? "bg-zinc-100 text-zinc-800",
        className,
      )}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}
