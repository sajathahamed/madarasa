"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

import { NavPendingHint } from "@/components/layout/nav-pending-hint";
import { cn } from "@/lib/utils";

type Props = ComponentProps<typeof Link> & {
  showHint?: boolean;
};

/** Link with optional inline pending spinner via useLinkStatus. */
export function PendingNavLink({
  children,
  className,
  showHint = true,
  ...props
}: Props) {
  return (
    <Link
      className={cn("inline-flex items-center gap-1.5", className)}
      {...props}
    >
      {children}
      {showHint ? <NavPendingHint /> : null}
    </Link>
  );
}
