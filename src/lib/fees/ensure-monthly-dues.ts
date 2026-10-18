import { applyOneTimeStudentFixes } from "@/lib/fees/one-time-student-fixes";
import { DEFAULT_MONTHLY_FEE } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll } from "@/lib/supabase/fetch-all";

type ActiveStudent = {
  id: string;
  vendor_id: string;
  branch_id: string;
};

type FeePlan = {
  student_id: string;
  monthly_amount: number;
  discount_percent: number;
  is_free: boolean;
  effective_from: string;
};

type PrevDue = {
  student_id: string;
  total_due: number;
  amount_paid: number;
};

function monthCharge(amount: number, discountPercent: number) {
  const net = amount * (1 - (Number(discountPercent) || 0) / 100);
  return Math.round(net * 100) / 100;
}

async function ensureMonthlyFeeDuesInner(month?: number, year?: number) {
  const admin = createAdminClient();
  const now = new Date();
  const dueMonth = month ?? now.getMonth() + 1;
  const dueYear = year ?? now.getFullYear();
  const prevMonth = dueMonth === 1 ? 12 : dueMonth - 1;
  const prevYear = dueMonth === 1 ? dueYear - 1 : dueYear;

  const [students, plans, existing, previous] = await Promise.all([
    fetchAll<ActiveStudent>((from, to) =>
      admin
        .from("students")
        .select("id, vendor_id, branch_id")
        .eq("status", "active")
        .order("id")
        .range(from, to),
    ),
    fetchAll<FeePlan>((from, to) =>
      admin
        .from("student_fee_plans")
        .select("student_id, monthly_amount, discount_percent, is_free, effective_from")
        .eq("is_current", true)
        .order("effective_from", { ascending: false })
        .order("student_id")
        .range(from, to),
    ),
    fetchAll<{ student_id: string }>((from, to) =>
      admin
        .from("fee_dues")
        .select("student_id")
        .eq("due_month", dueMonth)
        .eq("due_year", dueYear)
        .order("student_id")
        .range(from, to),
    ),
    fetchAll<PrevDue>((from, to) =>
      admin
        .from("fee_dues")
        .select("student_id, total_due, amount_paid")
        .eq("due_month", prevMonth)
        .eq("due_year", prevYear)
        .order("student_id")
        .range(from, to),
    ),
  ]);

  const planByStudent = new Map<string, FeePlan>();
  const freeStudents = new Set<string>();
  for (const plan of plans) {
    if (plan.is_free) freeStudents.add(plan.student_id);
    if (!planByStudent.has(plan.student_id)) planByStudent.set(plan.student_id, plan);
  }
  const already = new Set(existing.map((row) => row.student_id));
  const prevByStudent = new Map(previous.map((row) => [row.student_id, row]));

  const missingPlans = students.filter((student) => {
    if (already.has(student.id)) return false;
    const plan = planByStudent.get(student.id);
    return !plan;
  });

  for (let i = 0; i < missingPlans.length; i += 200) {
    const chunk = missingPlans.slice(i, i + 200).map((student) => ({
      student_id: student.id,
      monthly_amount: DEFAULT_MONTHLY_FEE,
      is_free: false,
      discount_percent: 0,
      is_current: true,
      effective_from: new Date().toISOString().slice(0, 10),
    }));
    const { error } = await admin.from("student_fee_plans").insert(chunk);
    if (error) throw new Error(error.message);
  }

  const dues = [];
  for (const student of students) {
    if (already.has(student.id) || freeStudents.has(student.id)) continue;
    const plan = planByStudent.get(student.id);

    const monthAmount = plan
      ? monthCharge(Number(plan.monthly_amount), Number(plan.discount_percent))
      : DEFAULT_MONTHLY_FEE;
    const prev = prevByStudent.get(student.id);
    const carried = prev
      ? Math.max(Number(prev.total_due) - Number(prev.amount_paid), 0)
      : 0;
    const total = Math.round((monthAmount + carried) * 100) / 100;

    dues.push({
      student_id: student.id,
      vendor_id: student.vendor_id,
      branch_id: student.branch_id,
      due_month: dueMonth,
      due_year: dueYear,
      month_amount: monthAmount,
      carried_forward: carried,
      total_due: total,
      amount_paid: 0,
      status: total === 0 ? "paid" : "unpaid",
    });
  }

  for (let i = 0; i < dues.length; i += 200) {
    const chunk = dues.slice(i, i + 200);
    const { error } = await admin.from("fee_dues").upsert(chunk, {
      onConflict: "student_id,due_month,due_year",
      ignoreDuplicates: true,
    });
    if (error) throw new Error(error.message);
  }

  return { generated: dues.length };
}

/** Add this month's fee for every active student who does not already have one. */
export async function ensureMonthlyFeeDues(
  month?: number,
  year?: number,
): Promise<{ generated: number; error?: string }> {
  await applyOneTimeStudentFixes();
  try {
    return await ensureMonthlyFeeDuesInner(month, year);
  } catch (err) {
    console.error("[ensureMonthlyFeeDues]", err);
    return {
      generated: 0,
      error: err instanceof Error ? err.message : "Failed to generate monthly dues",
    };
  }
}
