import Link from "next/link";

export function StatCard({
  label,
  value,
  hint,
  accent = "emerald",
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "emerald" | "amber" | "sky" | "rose" | "stone";
}) {
  const accents = {
    emerald: "from-[#0b3d2e] to-[#1a6b4f]",
    amber: "from-[#7a4e12] to-[#b87a2a]",
    sky: "from-[#1e4a6e] to-[#2f6f9c]",
    rose: "from-[#6b2a2a] to-[#9a3f3f]",
    stone: "from-[#3d4a45] to-[#5a6f65]",
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#0b3d2e]/10 bg-white/80 p-5 shadow-[0_10px_40px_-28px_rgba(11,61,46,0.45)]">
      <div
        className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${accents[accent]} opacity-[0.12]`}
      />
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#5a6f65]">
        {label}
      </p>
      <p
        className="mt-2 text-3xl text-[#0b3d2e] md:text-4xl"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs text-[#5a6f65]">{hint}</p> : null}
    </div>
  );
}

export function ModuleLink({
  href,
  title,
  description,
  meta,
}: {
  href: string;
  title: string;
  description: string;
  meta?: string;
}) {
  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-2xl border border-[#0b3d2e]/10 bg-white/75 p-5 shadow-[0_10px_40px_-28px_rgba(11,61,46,0.35)] transition duration-300 hover:-translate-y-0.5 hover:border-[#0b3d2e]/25 hover:bg-white"
    >
      <div className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-[#0b3d2e] transition duration-300 group-hover:scale-x-100" />
      <p
        className="text-lg text-[#0b3d2e]"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        {title}
      </p>
      <p className="mt-1 text-sm text-[#5a6f65]">{description}</p>
      <div className="mt-4 flex items-center justify-between text-sm text-[#0b3d2e]">
        <span className="underline-offset-4 group-hover:underline">Open</span>
        {meta ? <span className="text-xs text-[#5a6f65]">{meta}</span> : null}
      </div>
    </Link>
  );
}

export function DashboardHero({
  eyebrow,
  title,
  subtitle,
  arabic,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  arabic?: string;
}) {
  return (
    <section className="relative mb-8 overflow-hidden rounded-[1.75rem] border border-[#0b3d2e]/10 bg-[linear-gradient(135deg,#0b3d2e_0%,#145c45_48%,#1f7a5c_100%)] p-6 text-[#e8f5ee] shadow-[0_20px_60px_-30px_rgba(11,61,46,0.65)] md:p-8">
      <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-[#c9a227]/20 blur-2xl" />
      {eyebrow ? (
        <p className="text-xs uppercase tracking-[0.18em] text-[#b7d7c8]">
          {eyebrow}
        </p>
      ) : null}
      {arabic ? (
        <p
          className="mt-3 text-right text-2xl leading-relaxed text-[#f4efe2] md:text-3xl"
          dir="rtl"
          lang="ar"
          style={{ fontFamily: "var(--font-arabic), serif" }}
        >
          {arabic}
        </p>
      ) : null}
      <h2
        className="mt-3 max-w-2xl text-3xl text-white md:text-4xl"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        {title}
      </h2>
      <p className="mt-2 max-w-xl text-sm text-[#c5e0d2] md:text-base">
        {subtitle}
      </p>
    </section>
  );
}
