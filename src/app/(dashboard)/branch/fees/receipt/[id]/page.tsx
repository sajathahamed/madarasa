import { notFound } from "next/navigation";

import { PrintButton } from "@/components/fees/print-button";
import { OpsShell } from "@/components/layout/ops-shell";
import { requireOpsContext } from "@/lib/ops-page";
import { formatDate, formatMoney } from "@/lib/format";
import { brandingForVendorName } from "@/lib/vendor-branding";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, profile } = await requireOpsContext();

  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    .eq("id", id)
    .eq("status", "approved")
    .maybeSingle();

  if (!payment) notFound();

  const [{ data: student }, { data: vendor }, { data: branch }] =
    await Promise.all([
      supabase
        .from("students")
        .select("full_name, admission_no, guardian_name")
        .eq("id", payment.student_id)
        .maybeSingle(),
      supabase
        .from("vendors")
        .select("name")
        .eq("id", payment.vendor_id)
        .maybeSingle(),
      supabase
        .from("branches")
        .select("name")
        .eq("id", payment.branch_id)
        .maybeSingle(),
    ]);

  const branding = brandingForVendorName(vendor?.name);

  return (
    <OpsShell profile={profile} title="Payment receipt">
      <article className="mx-auto max-w-lg rounded-xl border border-[#0b3d2e]/15 bg-white p-4 sm:p-8 print:border-0 print:p-0">
        <header className="mb-6 border-b border-[#0b3d2e]/10 pb-4">
          <div className="flex items-center gap-3">
            {branding?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt={branding.nameEn}
                className="h-14 w-14 shrink-0 rounded-full object-cover"
              />
            ) : null}
            <div className="min-w-0">
              <p
                className="text-lg leading-snug text-[#0b3d2e] sm:text-xl"
                style={{ fontFamily: "serif" }}
              >
                {branding?.nameEn || vendor?.name || "Madarasa"}
              </p>
              {branding?.nameAr ? (
                <p
                  className="mt-0.5 text-base text-[#0b3d2e]/80"
                  dir="rtl"
                  lang="ar"
                  style={{ fontFamily: "var(--font-arabic), serif" }}
                >
                  {branding.nameAr}
                </p>
              ) : null}
              <p className="text-sm text-[#5a6f65]">{branch?.name}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-[#5a6f65]">
            Receipt #{payment.id.slice(0, 8)}
          </p>
        </header>
        <dl className="space-y-3 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <dt className="text-[#5a6f65]">Student</dt>
            <dd className="text-right break-words">{student?.full_name}</dd>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <dt className="text-[#5a6f65]">Admission</dt>
            <dd>{student?.admission_no}</dd>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <dt className="text-[#5a6f65]">Guardian</dt>
            <dd className="text-right break-words">{student?.guardian_name}</dd>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <dt className="text-[#5a6f65]">Amount</dt>
            <dd className="text-lg font-medium">
              {formatMoney(Number(payment.amount))}
            </dd>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <dt className="text-[#5a6f65]">Method</dt>
            <dd>{payment.method}</dd>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <dt className="text-[#5a6f65]">Date</dt>
            <dd>{formatDate(payment.created_at)}</dd>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <dt className="text-[#5a6f65]">Status</dt>
            <dd>Approved</dd>
          </div>
        </dl>
        <p className="mt-8 text-center text-xs text-[#5a6f65]">
          Official fee receipt — dual-approved ledger posting.
        </p>
        <PrintButton />
      </article>
    </OpsShell>
  );
}
