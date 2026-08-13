import { Loader2 } from "lucide-react";

/** Centered route-level loading indicator matching Madarasa brand tokens. */
export function PageSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 py-16"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2
        className="size-9 animate-spin text-[#0b3d2e]"
        aria-hidden
      />
      <p className="text-sm font-medium text-[#5a6f65]">{label}</p>
    </div>
  );
}
