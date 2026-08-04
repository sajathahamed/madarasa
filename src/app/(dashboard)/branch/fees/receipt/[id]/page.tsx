import { notFound } from "next/navigation";

import { PrintButton } from "@/components/fees/print-button";
import { OpsShell } from "@/components/layout/ops-shell";
import { requireOpsContext } from "@/lib/ops-page";
import { formatDate, formatMoney } from "@/lib/format";

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

  return (
    <OpsShell profile={profile} title="Payment receipt">
      <article className="mx-auto max-w-lg rounded-xl border border-[#0b3d2e]/15 bg-white p-8 print:border-0">
        <header className="mb-6 border-b border-[#0b3d2e]/10 pb-4">
          <p className="text-2xl text-[#0b3d2e]" style={{ fontFamily: "serif" }}>
            {vendor?.name || "Madarasa"}
          </p>
          <p className="text-sm text-[#5a6f65]">{branch?.name}</p>
          <p className="mt-2 text-xs text-[#5a6f65]">
            Receipt #{payment.id.slice(0, 8)}
          </p>
        </header>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-[#5a6f65]">Student</dt>
            <dd>{student?.full_name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#5a6f65]">Admission</dt>
            <dd>{student?.admission_no}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#5a6f65]">Guardian</dt>
            <dd>{student?.guardian_name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#5a6f65]">Amount</dt>
            <dd className="text-lg font-medium">
              {formatMoney(Number(payment.amount))}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#5a6f65]">Method</dt>
            <dd>{payment.method}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#5a6f65]">Date</dt>
            <dd>{formatDate(payment.created_at)}</dd>
          </div>
          <div className="flex justify-between">
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
