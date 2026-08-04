import { AppShell } from "@/components/layout/app-shell";
import { opsNav } from "@/lib/auth/session";
import type { AppUser } from "@/types/database";

export function OpsShell({
  profile,
  title,
  subtitle,
  children,
}: {
  profile: AppUser;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <AppShell
      profile={profile}
      title={title}
      subtitle={subtitle}
      nav={opsNav(profile)}
    >
      {children}
    </AppShell>
  );
}
