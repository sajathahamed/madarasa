"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";

import { PendingNavLink } from "@/components/layout/pending-nav-link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type NavItem = { href: string; label: string };

export function AppShellNav({ nav }: { nav: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => {
    const base = href.split("#")[0] || href;
    if (base === "/") return pathname === "/";
    return pathname === base || pathname.startsWith(`${base}/`);
  };

  return (
    <>
      <div className="border-b border-[#0b3d2e]/10 px-4 py-2 md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#0b3d2e]/20 bg-white/80 px-4 text-sm font-medium text-[#0b3d2e]">
            <Menu className="size-5 shrink-0" aria-hidden />
            Menu
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[min(100%,20rem)] border-[#0b3d2e]/10 bg-[#f7faf8] p-0"
          >
            <SheetHeader className="border-b border-[#0b3d2e]/10 px-4 py-4 text-left">
              <SheetTitle className="text-[#0b3d2e]">Navigate</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 overflow-y-auto p-3 pb-8">
              {nav.map((item) => (
                <PendingNavLink
                  key={item.href}
                  href={item.href}
                  prefetch
                  onClick={() => setOpen(false)}
                  className={`min-h-12 rounded-xl px-4 py-3 text-base transition ${
                    isActive(item.href)
                      ? "bg-[#0b3d2e] text-white"
                      : "text-[#0b3d2e] hover:bg-[#0b3d2e]/10"
                  }`}
                >
                  {item.label}
                </PendingNavLink>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      <nav className="mx-auto hidden max-w-6xl gap-1 overflow-x-auto px-4 pb-3 md:flex md:px-6">
        {nav.map((item) => (
          <PendingNavLink
            key={item.href}
            href={item.href}
            prefetch
            className={`whitespace-nowrap rounded-full px-4 py-2.5 text-sm transition ${
              isActive(item.href)
                ? "bg-[#0b3d2e] text-white"
                : "text-[#0b3d2e] hover:bg-[#0b3d2e] hover:text-white"
            }`}
          >
            {item.label}
          </PendingNavLink>
        ))}
      </nav>
    </>
  );
}
