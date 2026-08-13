import { logoutAction } from "@/actions/auth";
import { AppShellNav } from "@/components/layout/app-shell-nav";
import { Button } from "@/components/ui/button";
import { roleLabel } from "@/lib/auth/roles";
import type { VendorBranding } from "@/lib/vendor-branding";
import type { AppUser } from "@/types/database";

type NavItem = { href: string; label: string };

export function AppShell({
  profile,
  nav,
  title,
  children,
  subtitle,
  branding,
}: {
  profile: AppUser;
  nav: NavItem[];
  title: string;
  children: React.ReactNode;
  subtitle?: string;
  branding?: VendorBranding | null;
}) {
  const brandEn = branding?.nameEn ?? "Madarasa";
  const brandAr = branding?.nameAr ?? "مدرسة";

  return (
    <div
      className="min-h-screen"
      style={{
        fontFamily: "var(--font-sans), sans-serif",
        background:
          "radial-gradient(1200px 500px at 10% -10%, #d9ebe2 0%, transparent 55%), radial-gradient(900px 400px at 100% 0%, #e7efe6 0%, transparent 50%), linear-gradient(180deg, #f3f7f4 0%, #e9efeb 45%, #e4ebe6 100%)",
      }}
    >
      <header className="sticky top-0 z-40 border-b border-[#0b3d2e]/10 bg-[#f7faf8]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:gap-4 md:px-6 md:py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 sm:gap-3">
              {branding?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={branding.logoUrl}
                  alt={brandEn}
                  className="h-10 w-10 shrink-0 rounded-full object-cover sm:h-11 sm:w-11"
                />
              ) : null}
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 sm:gap-x-3">
                  <p
                    className="truncate text-sm font-medium leading-snug text-[#0b3d2e] sm:text-base md:text-lg"
                    style={{ fontFamily: "var(--font-display), serif" }}
                  >
                    {brandEn}
                  </p>
                  <p
                    className="hidden text-sm text-[#0b3d2e]/70 sm:block"
                    dir="rtl"
                    lang="ar"
                    style={{ fontFamily: "var(--font-arabic), serif" }}
                  >
                    {brandAr}
                  </p>
                </div>
                <p className="truncate text-xs text-[#5a6f65]">
                  {profile.full_name} · {roleLabel(profile.role)}
                </p>
              </div>
            </div>
          </div>
          <form action={logoutAction} className="shrink-0">
            <Button
              type="submit"
              variant="outline"
              className="min-h-10 rounded-full border-[#0b3d2e]/20 px-4"
            >
              Sign out
            </Button>
          </form>
        </div>
        <AppShellNav nav={nav} />
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:py-8 md:px-6">
        <div className="mb-5 print:hidden sm:mb-6">
          <h1
            className="text-2xl leading-tight text-[#0b3d2e] sm:text-3xl md:text-4xl"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-sm leading-relaxed text-[#5a6f65]">
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="min-w-0 space-y-6">{children}</div>
      </main>
    </div>
  );
}
