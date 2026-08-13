"use client";

import Link from "next/link";

import { NavPendingHint } from "@/components/layout/nav-pending-hint";

/** Student name link with pending spinner while the profile route loads. */
export function StudentProfileLink({
  studentId,
  children,
  className,
}: {
  studentId: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={`/branch/students/${studentId}`}
      className={`inline-flex items-center gap-1.5 ${className ?? ""}`}
    >
      <span>{children}</span>
      <NavPendingHint />
    </Link>
  );
}
