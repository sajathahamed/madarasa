import Link from "next/link";
import { Source_Serif_4, DM_Sans } from "next/font/google";

const display = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-display",
});

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export default function HomePage() {
  return (
    <main
      className={`${display.variable} ${sans.variable} relative flex min-h-screen flex-col overflow-hidden`}
      style={{ fontFamily: "var(--font-sans), sans-serif" }}
    >
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 20% 10%, #c8e6d0 0%, transparent 55%), radial-gradient(ellipse 70% 50% at 90% 80%, #d4e8f0 0%, transparent 50%), linear-gradient(165deg, #f7faf8 0%, #eef4f0 45%, #e8f0ea 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%230b3d2e' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />

      <header className="flex items-center justify-between px-6 py-5 md:px-12">
        <p
          className="text-2xl tracking-tight text-[#0b3d2e] md:text-3xl"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          Madarasa
        </p>
        <Link
          href="/login"
          className="rounded-lg border border-[#0b3d2e]/40 px-3 py-1.5 text-sm text-[#0b3d2e]"
        >
          Sign in
        </Link>
      </header>

      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-8 px-6 pb-24 pt-10 md:px-12">
        <div className="max-w-2xl space-y-5">
          <h1
            className="text-5xl leading-[1.05] text-[#0b3d2e] md:text-7xl"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            Madarasa
          </h1>
          <p className="max-w-lg text-lg text-[#2f4a3f]/90 md:text-xl">
            Multi-branch Islamic school management with double-entry books and
            two-step payment approval.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/login"
              className="inline-flex h-11 items-center rounded-lg bg-[#0b3d2e] px-5 text-[#f7faf8] hover:bg-[#0f4f3b]"
            >
              Enter platform
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
