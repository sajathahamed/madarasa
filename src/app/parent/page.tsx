import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ParentPortalClient } from "@/components/parent/parent-portal-client";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatMoney } from "@/lib/format";
import {
  parentLoginWithTokenAction,
  parentLogoutAction,
} from "@/actions/parent";

const PARENT_COOKIE = "madarasa_parent_session";

export default async function ParentPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (token) {
    const result = await parentLoginWithTokenAction(token);
    if (!result.error) redirect("/parent");
  }

  const jar = await cookies();
  const studentId = jar.get(PARENT_COOKIE)?.value;

  if (!studentId) {
    return (
      <main
        className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4"
        style={{
          background:
            "linear-gradient(180deg, #f4f8f5 0%, #eef3f0 40%, #e8eee9 100%)",
        }}
      >
        <h1 className="mb-2 text-3xl text-[#0b3d2e]" style={{ fontFamily: "serif" }}>
          Parent view
        </h1>
        <p className="mb-6 text-sm text-[#5a6f65]">
          Sign in with admission number and guardian phone, or open a shared link.
        </p>
        <ParentPortalClient />
        {token ? (
          <p className="mt-4 text-sm text-red-700">Invalid or expired link.</p>
        ) : null}
      </main>
    );
  }

  const admin = createAdminClient();
  const { data: student } = await admin
    .from("students")
    .select("id, full_name, admission_no, guardian_name, status, vendor_id")
    .eq("id", studentId)
    .maybeSingle();

  if (!student) {
    await parentLogoutAction();
    redirect("/parent");
  }

  const [{ data: dues }, { data: payments }, { data: progress }, { data: attRows }] =
    await Promise.all([
      admin
        .from("fee_dues")
        .select("due_month, due_year, total_due, amount_paid, status")
        .eq("student_id", studentId)
        .order("due_year", { ascending: false })
        .limit(12),
      admin
        .from("payments")
        .select("amount, status, method, created_at")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(12),
      admin
        .from("islamic_progress_logs")
        .select("stream, hifz_component, lesson_label, quality_note, logged_on")
        .eq("student_id", studentId)
        .order("logged_on", { ascending: false })
        .limit(15),
      admin
        .from("attendance_records")
        .select("status, session_id")
        .eq("student_id", studentId)
        .limit(30),
    ]);

  const sessionIds = [...new Set((attRows ?? []).map((r) => r.session_id))];
  const { data: sessionRows } =
    sessionIds.length > 0
      ? await admin
          .from("attendance_sessions")
          .select("id, session_date")
          .in("id", sessionIds)
      : { data: [] as { id: string; session_date: string }[] };
  const sessionDate = new Map(
    (sessionRows ?? []).map((s) => [s.id, s.session_date]),
  );

  const attendance = (attRows ?? []).map((r) => ({
    date: sessionDate.get(r.session_id) || "",
    status: r.status,
  }));

  return (
    <main
      className="mx-auto min-h-screen max-w-lg px-4 py-10"
      style={{
        background:
          "linear-gradient(180deg, #f4f8f5 0%, #eef3f0 40%, #e8eee9 100%)",
      }}
    >
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[#5a6f65]">Parent portal</p>
          <h1 className="text-3xl text-[#0b3d2e]" style={{ fontFamily: "serif" }}>
            {student.full_name}
          </h1>
          <p className="text-sm text-[#5a6f65]">
            {student.admission_no} · {student.guardian_name}
          </p>
        </div>
        <form action={parentLogoutAction}>
          <button
            type="submit"
            className="rounded-lg border border-[#0b3d2e]/20 px-3 py-1.5 text-sm"
          >
            Sign out
          </button>
        </form>
      </div>

      <section className="mb-6 rounded-xl border border-[#0b3d2e]/10 bg-white/80 p-4">
        <h2 className="mb-3 font-medium text-[#0b3d2e]">Fees</h2>
        <ul className="space-y-2 text-sm">
          {(dues ?? []).map((d, i) => (
            <li key={i} className="flex justify-between">
              <span>
                {d.due_month}/{d.due_year} · {d.status}
              </span>
              <span>
                {formatMoney(Number(d.amount_paid))} /{" "}
                {formatMoney(Number(d.total_due))}
              </span>
            </li>
          ))}
          {(dues ?? []).length === 0 ? (
            <li className="text-[#5a6f65]">No dues listed.</li>
          ) : null}
        </ul>
        <h3 className="mb-2 mt-4 text-sm font-medium">Payments</h3>
        <ul className="space-y-2 text-sm">
          {(payments ?? []).map((p, i) => (
            <li key={i} className="flex justify-between">
              <span>
                {formatDate(p.created_at)} · {p.method} · {p.status}
              </span>
              <span>{formatMoney(Number(p.amount))}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-6 rounded-xl border border-[#0b3d2e]/10 bg-white/80 p-4">
        <h2 className="mb-3 font-medium text-[#0b3d2e]">Attendance</h2>
        <ul className="space-y-2 text-sm">
          {attendance.map((a, i) => (
            <li key={i} className="flex justify-between">
              <span>{a.date}</span>
              <span className="capitalize">{a.status}</span>
            </li>
          ))}
          {attendance.length === 0 ? (
            <li className="text-[#5a6f65]">No attendance yet.</li>
          ) : null}
        </ul>
      </section>

      <section className="rounded-xl border border-[#0b3d2e]/10 bg-white/80 p-4">
        <h2 className="mb-3 font-medium text-[#0b3d2e]">Progress</h2>
        <ul className="space-y-2 text-sm">
          {(progress ?? []).map((p, i) => (
            <li key={i}>
              <p className="font-medium">
                {p.stream}
                {p.hifz_component ? ` / ${p.hifz_component}` : ""} · {p.lesson_label}
              </p>
              <p className="text-xs text-[#5a6f65]">
                {formatDate(p.logged_on)}
                {p.quality_note ? ` · ${p.quality_note}` : ""}
              </p>
            </li>
          ))}
          {(progress ?? []).length === 0 ? (
            <li className="text-[#5a6f65]">No progress notes yet.</li>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
