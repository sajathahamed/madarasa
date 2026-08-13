import { ExpensesClient } from "@/components/expenses/expenses-client";
import { OpsShell } from "@/components/layout/ops-shell";
import { canEnterData } from "@/lib/auth/session";
import { requireOpsContext } from "@/lib/ops-page";

export default async function ExpensesPage() {
  const { supabase, profile } = await requireOpsContext();

  let branchesQ = supabase
    .from("branches")
    .select("id, name, vendor_id")
    .order("name");
  let expensesQ = supabase
    .from("expenses")
    .select(
      "id, category, title, amount, expense_date, payee, payment_method, notes, created_at, created_by",
    )
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (profile.vendor_id) {
    branchesQ = branchesQ.eq("vendor_id", profile.vendor_id);
    expensesQ = expensesQ.eq("vendor_id", profile.vendor_id);
  }
  if (profile.branch_id) {
    expensesQ = expensesQ.eq("branch_id", profile.branch_id);
  }

  const [{ data: branches }, { data: expenses }] = await Promise.all([
    branchesQ,
    expensesQ,
  ]);

  const vendorId = profile.vendor_id || branches?.[0]?.vendor_id || "";
  const branchId = profile.branch_id || branches?.[0]?.id || "";

  const creatorIds = [
    ...new Set((expenses ?? []).map((e) => e.created_by).filter(Boolean)),
  ];
  const nameById = new Map<string, string>();
  if (creatorIds.length > 0) {
    const { data: users } = await supabase
      .from("app_users")
      .select("id, full_name")
      .in("id", creatorIds);
    for (const u of users ?? []) nameById.set(u.id, u.full_name);
  }

  return (
    <OpsShell
      profile={profile}
      title="Expenses"
      subtitle="Track madarasa outflows — salaries, utilities, kitchen, repairs, and more"
    >
      <ExpensesClient
        vendorId={vendorId}
        branchId={branchId}
        canRecord={canEnterData(profile.role)}
        expenses={(expenses ?? []).map((e) => ({
          id: e.id,
          category: e.category,
          title: e.title,
          amount: Number(e.amount),
          expense_date: e.expense_date,
          payee: e.payee,
          payment_method: e.payment_method,
          notes: e.notes,
          created_at: e.created_at,
          created_by_name: nameById.get(e.created_by) ?? null,
        }))}
      />
    </OpsShell>
  );
}
