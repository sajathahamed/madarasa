import Link from "next/link";
import { DM_Sans, Source_Serif_4 } from "next/font/google";

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

type NavItem = { href: string; label: string };

export function AppShell({
  profile,
  nav,
  title,
  children,
}: {
  profile: AppUser;
  nav: NavItem[];
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${display.variable} ${sans.variable} min-h-screen`}
      style={{
        fontFamily: "var(--font-sans), sans-serif",
        background:
          "linear-gradient(180deg, #f4f8f5 0%, #eef3f0 40%, #e8eee9 100%)",
      }}
    >
      <header className="border-b border-[#0b3d2e]/10 bg-[#f7faf8]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div>
            <p
              className="text-xl text-[#0b3d2e]"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              Madarasa
            </p>
            <p className="text-xs text-[#5a6f65]">
              {profile.full_name} ·{" "}
              {(profile.role ?? "unknown").replaceAll("_", " ")}
            </p>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3 md:px-6">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-sm text-[#0b3d2e] hover:bg-[#0b3d2e]/8"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <h1
          className="mb-6 text-3xl text-[#0b3d2e]"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          {title}
        </h1>
        {children}
      </main>
    </div>
  );
}
