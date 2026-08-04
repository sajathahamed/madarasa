import Link from "next/link";
import { Amiri, DM_Sans, Source_Serif_4 } from "next/font/google";

import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import type { AppUser } from "@/types/database";

const display = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-display",
});

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const arabic = Amiri({
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  variable: "--font-arabic",
});

type NavItem = { href: string; label: string };

export function AppShell({
  profile,
  nav,
  title,
  children,
  subtitle,
}: {
  profile: AppUser;
  nav: NavItem[];
  title: string;
  children: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div
      className={`${display.variable} ${sans.variable} ${arabic.variable} min-h-screen`}
      style={{
        fontFamily: "var(--font-sans), sans-serif",
        background:
          "radial-gradient(1200px 500px at 10% -10%, #d9ebe2 0%, transparent 55%), radial-gradient(900px 400px at 100% 0%, #e7efe6 0%, transparent 50%), linear-gradient(180deg, #f3f7f4 0%, #e9efeb 45%, #e4ebe6 100%)",
      }}
    >
      <header className="sticky top-0 z-40 border-b border-[#0b3d2e]/10 bg-[#f7faf8]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="min-w-0">
            <div className="flex items-baseline gap-3">
              <p
                className="text-xl text-[#0b3d2e]"
                style={{ fontFamily: "var(--font-display), serif" }}
              >
                Madarasa
              </p>
              <p
                className="hidden text-sm text-[#0b3d2e]/70 sm:block"
                dir="rtl"
                lang="ar"
                style={{ fontFamily: "var(--font-arabic), serif" }}
              >
                مدرسة
              </p>
            </div>
            <p className="truncate text-xs text-[#5a6f65]">
              {profile.full_name} ·{" "}
              {(profile.role ?? "unknown").replaceAll("_", " ")}
            </p>
          </div>
          <form action={logoutAction}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="rounded-full border-[#0b3d2e]/20"
            >
              Sign out
            </Button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3 md:px-6">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm text-[#0b3d2e] transition hover:bg-[#0b3d2e] hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <div className="mb-6">
          <h1
            className="text-3xl text-[#0b3d2e] md:text-4xl"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-[#5a6f65]">{subtitle}</p>
          ) : null}
        </div>
        {children}
      </main>
    </div>
  );
}
