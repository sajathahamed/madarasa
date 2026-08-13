import { cache } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { opsNav } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { brandingForVendorName } from "@/lib/vendor-branding";
import type { AppUser } from "@/types/database";

const vendorBranding = cache(async (vendorId: string) => {
  const supabase = await createClient();
  const { data: vendor } = await supabase
    .from("vendors")
    .select("name")
    .eq("id", vendorId)
    .maybeSingle();
  return brandingForVendorName(vendor?.name);
});

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
  const branding = profile.vendor_id
    ? await vendorBranding(profile.vendor_id)
    : null;

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
