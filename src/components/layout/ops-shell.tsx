import { AppShell } from "@/components/layout/app-shell";
import { opsNav } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { brandingForVendorName } from "@/lib/vendor-branding";
import type { AppUser } from "@/types/database";

export async function OpsShell({
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
  let branding = null;
  if (profile.vendor_id) {
    const supabase = await createClient();
    const { data: vendor } = await supabase
      .from("vendors")
      .select("name")
      .eq("id", profile.vendor_id)
      .maybeSingle();
    branding = brandingForVendorName(vendor?.name);
  }

  return (
    <AppShell
      profile={profile}
      title={title}
      subtitle={subtitle}
      nav={opsNav(profile)}
      branding={branding}
    >
      {children}
    </AppShell>
  );
}
