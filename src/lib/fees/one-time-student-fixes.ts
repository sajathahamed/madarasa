import { DEFAULT_MONTHLY_FEE } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

const DELETE_NIFRAAS = "fix_delete_nifraas_468_2";
const SET_AMHAR_BALANCE = "fix_amhar_778_balance_136000";
const AMHAR_BALANCE = 136000;

async function fixAlreadyApplied(
  admin: ReturnType<typeof createAdminClient>,
  action: string,
) {
  const { data, error } = await admin
    .from("audit_logs")
    .select("id")
    .eq("action", action)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

async function deleteNifraas(admin: ReturnType<typeof createAdminClient>) {
  if (await fixAlreadyApplied(admin, DELETE_NIFRAAS)) return;

  const { data, error } = await admin
    .from("students")
    .select("id, full_name, admission_no, vendor_id, status")
    .eq("admission_no", "468-2")
    .ilike("full_name", "%nifra%");
  if (error) throw new Error(error.message);

  const matches = data ?? [];
  if (matches.length === 0) return;
  if (matches.length !== 1) {
    throw new Error("More than one Nifraas 468-2 match; nothing deleted");
  }

  const student = matches[0];

  const { error: loanError } = await admin
    .from("library_loans")
    .delete()
    .eq("student_id", student.id);
  if (loanError) throw new Error(loanError.message);

  const { data: payments, error: paymentReadError } = await admin
    .from("payments")
    .select("id, status")
    .eq("student_id", student.id);
  if (paymentReadError) throw new Error(paymentReadError.message);

  for (const payment of payments ?? []) {
    if (payment.status !== "approved") continue;
    const { data: entries, error: entryError } = await admin
      .from("ledger_entries")
      .select("id, account_id, amount")
      .eq("source_table", "payments")
      .eq("source_id", payment.id);
    if (entryError) throw new Error(entryError.message);

    for (const entry of entries ?? []) {
      const { data: account, error: accountError } = await admin
        .from("accounts")
        .select("id, current_balance")
        .eq("id", entry.account_id)
        .maybeSingle();
      if (accountError) throw new Error(accountError.message);
      if (!account) continue;
      const { error: updateError } = await admin
        .from("accounts")
        .update({
          current_balance: Number(account.current_balance) - Number(entry.amount),
        })
        .eq("id", account.id);
      if (updateError) throw new Error(updateError.message);
    }

    if ((entries ?? []).length > 0) {
      const { error: ledgerDeleteError } = await admin
        .from("ledger_entries")
        .delete()
        .eq("source_table", "payments")
        .eq("source_id", payment.id);
      if (ledgerDeleteError) throw new Error(ledgerDeleteError.message);
    }
  }

  const { error: whatsappError } = await admin
    .from("whatsapp_messages")
    .update({ student_id: null })
    .eq("student_id", student.id);
  if (whatsappError) throw new Error(whatsappError.message);

  const { error: paymentDeleteError } = await admin
    .from("payments")
    .delete()
    .eq("student_id", student.id);
  if (paymentDeleteError) throw new Error(paymentDeleteError.message);

  const { error: studentDeleteError } = await admin
    .from("students")
    .delete()
    .eq("id", student.id);
  if (studentDeleteError) throw new Error(studentDeleteError.message);

  await admin.from("audit_logs").insert({
    vendor_id: student.vendor_id,
    action: DELETE_NIFRAAS,
    table_name: "students",
    record_id: student.id,
    old_data: {
      full_name: student.full_name,
      admission_no: student.admission_no,
      status: student.status,
    },
    new_data: { deleted: true },
  });
}

async function setAmharBalance(admin: ReturnType<typeof createAdminClient>) {
  if (await fixAlreadyApplied(admin, SET_AMHAR_BALANCE)) return;

  const { data: named, error: namedError } = await admin
    .from("students")
    .select("id, full_name, admission_no, vendor_id, branch_id")
    .eq("admission_no", "778")
    .ilike("full_name", "%amhar%");
  if (namedError) throw new Error(namedError.message);

  let matches = named ?? [];
  if (matches.length === 0) {
    const { data: byNo, error: byNoError } = await admin
      .from("students")
      .select("id, full_name, admission_no, vendor_id, branch_id")
      .eq("admission_no", "778");
    if (byNoError) throw new Error(byNoError.message);
    matches = byNo ?? [];
  }
  if (matches.length !== 1) return;

  const student = matches[0];
  const { data: dues, error: duesError } = await admin
    .from("fee_dues")
    .select("id, due_year, due_month, total_due, amount_paid, month_amount")
    .eq("student_id", student.id)
    .order("due_year", { ascending: false })
    .order("due_month", { ascending: false });
  if (duesError) throw new Error(duesError.message);

  const rows = dues ?? [];
  const now = new Date();
  let targetId = rows[0]?.id;

  if (!targetId) {
    const monthAmount = DEFAULT_MONTHLY_FEE;
    const { data: inserted, error: insertError } = await admin
      .from("fee_dues")
      .insert({
        student_id: student.id,
        vendor_id: student.vendor_id,
        branch_id: student.branch_id,
        due_month: now.getMonth() + 1,
        due_year: now.getFullYear(),
        month_amount: monthAmount,
        carried_forward: AMHAR_BALANCE - monthAmount,
        total_due: AMHAR_BALANCE,
        amount_paid: 0,
        status: "unpaid",
      })
      .select("id")
      .single();
    if (insertError) throw new Error(insertError.message);
    targetId = inserted.id;
  } else {
    const target = rows[0];
    const paid = Number(target.amount_paid);
    const total = Math.round((paid + AMHAR_BALANCE) * 100) / 100;
    const monthAmount =
      Number(target.month_amount) > 0
        ? Number(target.month_amount)
        : DEFAULT_MONTHLY_FEE;
    const { error: updateError } = await admin
      .from("fee_dues")
      .update({
        total_due: total,
        month_amount: monthAmount,
        carried_forward: Math.max(0, Math.round((total - monthAmount) * 100) / 100),
        status: paid > 0 ? "partial" : "unpaid",
      })
      .eq("id", target.id);
    if (updateError) throw new Error(updateError.message);

    for (const due of rows.slice(1)) {
      const dueTotal = Number(due.total_due);
      const { error: closeError } = await admin
        .from("fee_dues")
        .update({
          amount_paid: dueTotal,
          status: "paid",
        })
        .eq("id", due.id);
      if (closeError) throw new Error(closeError.message);
    }
  }

  await admin.from("audit_logs").insert({
    vendor_id: student.vendor_id,
    action: SET_AMHAR_BALANCE,
    table_name: "students",
    record_id: student.id,
    new_data: {
      full_name: student.full_name,
      admission_no: student.admission_no,
      balance: AMHAR_BALANCE,
      fee_due_id: targetId,
    },
  });
}

/** Runs once after deploy. Safe to call on every page load. */
export async function applyOneTimeStudentFixes() {
  try {
    const admin = createAdminClient();
    await deleteNifraas(admin);
    await setAmharBalance(admin);
  } catch (err) {
    console.error("[applyOneTimeStudentFixes]", err);
  }
}
