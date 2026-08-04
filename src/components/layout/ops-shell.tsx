import { AppShell } from "@/components/layout/app-shell";
import { opsNav } from "@/lib/auth/session";
import type { AppUser } from "@/types/database";

export function OpsShell({
  profile,
  title,
  children,
}: {
  profile: AppUser;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <AppShell profile={profile} title={title} nav={opsNav(profile)}>
      {children}
    </AppShell>
  );
}
