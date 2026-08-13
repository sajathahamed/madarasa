"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";

/** Inline spinner for a clicked Link; delayed so fast navigations don’t flash. */
export function NavPendingHint({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus();

  return (
    <Loader2
      aria-hidden
      className={`size-3.5 shrink-0 animate-spin text-current transition-opacity duration-150 ${
        pending ? "opacity-100 delay-100" : "opacity-0"
      } ${className}`}
    />
  );
}
