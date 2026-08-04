"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Amiri, DM_Sans, Source_Serif_4 } from "next/font/google";

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

const arabic = Amiri({
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  variable: "--font-arabic",
});

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <main
      className={`${display.variable} ${sans.variable} ${arabic.variable} flex min-h-screen`}
      style={{ fontFamily: "var(--font-sans), sans-serif" }}
    >
      <div className="relative hidden w-[52%] overflow-hidden lg:block">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 20% 20%, rgba(201,162,39,0.22), transparent 40%), linear-gradient(160deg, #07281e 0%, #0b3d2e 42%, #146049 78%, #1a7a5c 100%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
        <div className="relative z-10 flex h-full flex-col justify-between p-12 text-[#e8f5ee]">
          <div>
            <p
              className="text-sm tracking-[0.22em] text-[#c9a227]"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              MADARASA
            </p>
            <p
              className="mt-10 max-w-md text-right text-4xl leading-[1.55] text-[#f6f0e4] xl:text-5xl"
              dir="rtl"
              lang="ar"
              style={{ fontFamily: "var(--font-arabic), serif" }}
            >
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </p>
            <p
              className="mt-6 max-w-md text-right text-xl leading-relaxed text-[#d7ebe1]"
              dir="rtl"
              lang="ar"
              style={{ fontFamily: "var(--font-arabic), serif" }}
            >
              ٱقْرَأْ بِٱسْمِ رَبِّكَ ٱلَّذِى خَلَقَ
            </p>
            <p className="mt-3 max-w-sm text-sm text-[#9fc4b4]">
              “Read in the name of your Lord who created.” — Qur’an 96:1
            </p>
          </div>
          <div>
            <p
              className="text-4xl text-white"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              Madarasa
            </p>
            <p
              className="mt-2 text-lg text-[#c9a227]"
              dir="rtl"
              lang="ar"
              style={{ fontFamily: "var(--font-arabic), serif" }}
            >
              نورُ العلم · أمانةُ الإدارة
            </p>
            <p className="mt-3 max-w-sm text-[#c5e0d2]">
              Secure multi-tenant ledgers, attendance, and parent updates for
              every branch.
            </p>
          </div>
        </div>
      </div>

      <div
        className="flex w-full flex-col justify-center px-6 py-12 lg:w-[48%] lg:px-16"
        style={{
          background:
            "radial-gradient(600px 280px at 100% 0%, #e7f1ea 0%, transparent 60%), #fbfcfb",
        }}
      >
        <Link
          href="/"
          className="mb-8 text-2xl text-[#0b3d2e] lg:hidden"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          Madarasa
        </Link>
        <p
          className="mb-2 text-right text-2xl text-[#0b3d2e] lg:hidden"
          dir="rtl"
          lang="ar"
          style={{ fontFamily: "var(--font-arabic), serif" }}
        >
          أهلاً وسهلاً
        </p>
        <h1
          className="text-3xl text-[#0b3d2e]"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          Sign in
        </h1>
        <p className="mt-1 text-sm text-[#5a6f65]">
          Welcome back — enter your staff credentials to continue.
        </p>
        <p
          className="mt-2 hidden text-right text-lg text-[#0b3d2e]/80 lg:block"
          dir="rtl"
          lang="ar"
          style={{ fontFamily: "var(--font-arabic), serif" }}
        >
          أهلاً وسهلاً بكم في مدرسة
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
              className="h-12 rounded-xl border-[#0b3d2e]/15 bg-white"
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
              className="h-12 rounded-xl border-[#0b3d2e]/15 bg-white"
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
            className="h-12 w-full rounded-xl bg-[#0b3d2e] text-base hover:bg-[#0f4f3b]"
          >
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p
          className="mt-10 text-center text-sm text-[#5a6f65]"
          dir="rtl"
          lang="ar"
          style={{ fontFamily: "var(--font-arabic), serif" }}
        >
          وَقُل رَّبِّ زِدْنِي عِلْمًا
        </p>
      </div>
    </main>
  );
}
