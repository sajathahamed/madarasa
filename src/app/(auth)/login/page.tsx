"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Source_Serif_4, DM_Sans } from "next/font/google";

import { loginAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const display = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-display",
});

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <main
      className={`${display.variable} ${sans.variable} flex min-h-screen`}
      style={{ fontFamily: "var(--font-sans), sans-serif" }}
    >
      <div
        className="relative hidden w-1/2 lg:block"
        style={{
          background:
            "linear-gradient(160deg, #0b3d2e 0%, #146049 50%, #1a7a5c 100%)",
        }}
      >
        <div className="absolute inset-0 flex flex-col justify-end p-12 text-[#e8f5ee]">
          <p
            className="text-4xl"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            Madarasa
          </p>
          <p className="mt-3 max-w-sm text-[#c5e0d2]">
            Secure multi-tenant ledgers for every branch.
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-16">
        <Link
          href="/"
          className="mb-10 text-2xl text-[#0b3d2e] lg:hidden"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          Madarasa
        </Link>
        <h1 className="text-2xl font-medium text-[#0b3d2e]">Sign in</h1>
        <p className="mt-1 text-sm text-[#5a6f65]">
          Use your platform credentials to continue.
        </p>

        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            setError(null);
            startTransition(async () => {
              const result = await loginAction(formData);
              if (result.error) {
                setError(result.error);
                return;
              }
              if (result.redirectTo) {
                router.push(result.redirectTo);
                router.refresh();
              }
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="h-11"
            />
          </div>
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={pending}
            className="h-11 w-full bg-[#0b3d2e] hover:bg-[#0f4f3b]"
          >
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </main>
  );
}
