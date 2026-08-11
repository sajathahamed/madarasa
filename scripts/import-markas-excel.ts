/**
 * Wipe eravur markaz student/fee data and re-import from
 * "Monthly Fee mangent EDIT.xlsx".
 *
 * Amount source: column "Total pending" (already includes August).
 * Payments: column "August payment" (amount paid) + optional "Paid by".
 *
 * Usage:
 *   npx tsx scripts/import-markas-excel.ts --dry-run
 *   npx tsx scripts/import-markas-excel.ts --wipe
 *   npx tsx scripts/import-markas-excel.ts --payments-only
 *     (import August payment rows into existing students; no wipe)
 */
import { existsSync } from "fs";
import { join } from "path";
import { config } from "dotenv";
import pg from "pg";
import * as XLSX from "xlsx";

config({ path: ".env.local" });

const VENDOR_NAME = "eravur markaz";
const BRANCH_NAME = "main";
const MONTHLY_AMOUNT = 12000;
const DUE_MONTH = 8;
const DUE_YEAR = 2026;
const DEFAULT_PHONE = "00000000";
const DEFAULT_GUARDIAN = "Guardian";
const EXCEL_CANDIDATES = [
  "Monthly Fee mangent EDIT.xlsx",
  "Monthly Fee mangent.xlsx",
];

type ParsedRow = {
  excelIndex: string;
  admissionNo: string;
  fullName: string;
  gradeRaw: string | number;
  className: string;
  address: string | null;
  phone: string;
  totalPending: number;
  /** Derived: totalPending / MONTHLY_AMOUNT (may be fractional). */
  pendingMonths: number;
  /** Optional Excel "Pending Months" col for cross-check only. */
  excelPendingMonths: number | null;
  /** Excel "August payment" — amount already paid. */
  augustPayment: number;
  /** Who paid (Excel "Paid by" if present, else student name). */
  paidBy: string;
  status: "active" | "left";
  remappedFrom?: string;
};

function resolveExcelPath(): string {
  for (const name of EXCEL_CANDIDATES) {
    const p = join(process.cwd(), name);
    if (existsSync(p)) return p;
  }
  throw new Error(
    `Excel not found. Tried: ${EXCEL_CANDIDATES.join(", ")}`,
  );
}

function classNameFromGrade(grade: string | number): string {
  const raw = String(grade ?? "").trim();
  if (!raw) return "Unassigned";
  const lower = raw.toLowerCase();
  if (lower === "hifz") return "Hifz";
  if (lower === "inaam") return "Inaam";
  const n = Number(raw);
  if (!Number.isNaN(n) && n >= 1 && n <= 7) return `Sariya ${n}`;
  return raw;
}

function parsePhone(raw: unknown): string {
  if (raw == null || raw === "") return DEFAULT_PHONE;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 8) return DEFAULT_PHONE;
  return digits;
}

function isLeftMarker(raw: unknown): boolean {
  return typeof raw === "string" && raw.trim().toLowerCase() === "left";
}

function parseMoney(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "string") {
    if (isLeftMarker(raw)) return null;
    const cleaned = raw.replace(/,/g, "").trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isNaN(n) ? null : n;
  }
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

function monthsFromPending(totalPending: number): number {
  if (totalPending <= 0) return 0;
  return Math.round((totalPending / MONTHLY_AMOUNT) * 100) / 100;
}

function loadExcel(path: string): ParsedRow[] {
  const wb = XLSX.readFile(path);
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
  });

  const header = (rows[0] ?? []).map((h) =>
    String(h ?? "")
      .trim()
      .toLowerCase(),
  );
  const findCol = (...needles: string[]) => {
    for (let i = 0; i < header.length; i++) {
      const h = header[i] ?? "";
      if (needles.some((n) => h.includes(n))) return i;
    }
    return -1;
  };

  // Defaults match EDIT.xlsx layout; override if headers rename.
  const colIndex = findCol("index") >= 0 ? findCol("index") : 1;
  const colName = findCol("name") >= 0 ? findCol("name") : 2;
  const colGrade = findCol("grade") >= 0 ? findCol("grade") : 3;
  const colAddr = findCol("address") >= 0 || findCol("d") === 4 ? (findCol("address") >= 0 ? findCol("address") : 4) : 4;
  const colPhone = findCol("p.no", "phone", "mobile") >= 0 ? findCol("p.no", "phone", "mobile") : 5;
  const colPendingMonths = findCol("pending month") >= 0 ? findCol("pending month") : 6;
  const colBal3007 = findCol("30.07", "balance on") >= 0 ? findCol("30.07", "balance on") : 7;
  const colAugust = findCol("augest", "august") >= 0 && findCol("augest payment", "august payment") < 0
    ? findCol("augest", "august")
    : 8;
  const colTotal = findCol("total pending") >= 0 ? findCol("total pending") : 9;
  const colAugPay = findCol("augest payment", "august payment", "payment") >= 0
    ? findCol("augest payment", "august payment", "payment")
    : 10;
  const colBalance = findCol("balance") >= 0 && findCol("balance on") !== findCol("balance")
    ? (() => {
        // Prefer last "Balance" that is not "BALANCE ON"
        for (let i = header.length - 1; i >= 0; i--) {
          const h = header[i] ?? "";
          if (h.includes("balance") && !h.includes("30.07") && !h.includes("on")) return i;
        }
        return 11;
      })()
    : 11;
  const colPaidBy = findCol("paid by", "payer", "who paid", "received by");

  const seen = new Map<string, number>();
  const out: ParsedRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const indexRaw = row[colIndex];
    const nameRaw = row[colName];
    if (indexRaw == null && (nameRaw == null || String(nameRaw).trim() === "")) {
      continue;
    }
    if (indexRaw == null) {
      console.warn(`Skipping row ${i + 1}: missing Index`);
      continue;
    }

    const excelIndex = String(indexRaw).trim();
    const fullName = String(nameRaw ?? "").trim();
    if (!fullName) {
      console.warn(`Skipping Index ${excelIndex}: missing name`);
      continue;
    }

    const count = (seen.get(excelIndex) ?? 0) + 1;
    seen.set(excelIndex, count);
    const remapped = count > 1;
    const admissionNo = remapped ? `${excelIndex}-${count}` : excelIndex;

    const left =
      isLeftMarker(row[colPendingMonths]) ||
      isLeftMarker(row[colBal3007]) ||
      isLeftMarker(row[colTotal]) ||
      isLeftMarker(row[colBalance]);

    const totalPendingRaw =
      parseMoney(row[colTotal]) ??
      parseMoney(row[colBalance]) ??
      (parseMoney(row[colBal3007]) != null && parseMoney(row[colAugust]) != null
        ? (parseMoney(row[colBal3007]) as number) +
          (parseMoney(row[colAugust]) as number)
        : null) ??
      0;
    const totalPending = left ? 0 : Math.max(0, totalPendingRaw);
    const excelPendingMonths = left ? null : parseMoney(row[colPendingMonths]);
    const augustPayment = left
      ? 0
      : Math.max(0, parseMoney(row[colAugPay]) ?? 0);

    let paidBy = fullName;
    if (colPaidBy >= 0 && row[colPaidBy] != null && String(row[colPaidBy]).trim()) {
      paidBy = String(row[colPaidBy]).trim();
    }

    const gradeRaw = (row[colGrade] ?? "") as string | number;
    const addrRaw = row[colAddr];

    out.push({
      excelIndex,
      admissionNo,
      fullName,
      gradeRaw,
      className: classNameFromGrade(gradeRaw),
      address:
        addrRaw != null && String(addrRaw).trim() ? String(addrRaw).trim() : null,
      phone: parsePhone(row[colPhone]),
      totalPending,
      pendingMonths: monthsFromPending(totalPending),
      excelPendingMonths,
      augustPayment,
      paidBy,
      status: left ? "left" : "active",
      remappedFrom: remapped ? excelIndex : undefined,
    });
  }

  return out;
}

async function resolveRecorderId(
  client: pg.Client,
  vendorId: string,
): Promise<string> {
  const admin = await client.query<{ id: string }>(
    `select id from public.app_users
     where vendor_id = $1 and role = 'vendor_admin' and status = 'active'
     order by created_at asc
     limit 1`,
    [vendorId],
  );
  if (admin.rows[0]) return admin.rows[0].id;
  const any = await client.query<{ id: string }>(
    `select id from public.app_users
     where vendor_id = $1 and status = 'active'
     limit 1`,
    [vendorId],
  );
  if (!any.rows[0]) {
    throw new Error("No app_users on vendor to set as recorded_by for payments");
  }
  return any.rows[0].id;
}

/** Insert approved payment (triggers ledger via status update) and note payer. */
async function importPaymentForStudent(
  client: pg.Client,
  opts: {
    vendorId: string;
    branchId: string;
    studentId: string;
    feeDueId: string | null;
    amount: number;
    recordedBy: string;
    paidBy: string;
  },
) {
  if (opts.amount <= 0) return false;

  const inserted = await client.query<{ id: string }>(
    `insert into public.payments (
       vendor_id, branch_id, student_id, fee_due_id,
       amount, method, bank_reference, recorded_by, status
     ) values ($1,$2,$3,$4,$5,'cash',$6,$7,'pending_accountant')
     returning id`,
    [
      opts.vendorId,
      opts.branchId,
      opts.studentId,
      opts.feeDueId,
      opts.amount,
      `Excel paid by: ${opts.paidBy}`,
      opts.recordedBy,
    ],
  );
  const paymentId = inserted.rows[0].id;

  await client.query(
    `update public.payments set
       status = 'approved',
       accountant_id = $2,
       accountant_action_at = now(),
       principal_id = $2,
       principal_action_at = now(),
       accountant_remarks = $3,
       principal_remarks = $3
     where id = $1`,
    [paymentId, opts.recordedBy, `Imported from Excel — paid by ${opts.paidBy}`],
  );
  return true;
}

async function wipeVendorBranch(
  client: pg.Client,
  vendorId: string,
  branchId: string,
) {
  console.log("Wiping existing markaz/main operational data…");

  // Ledger for payments/donations of this branch
  await client.query(
    `delete from public.ledger_entries
     where vendor_id = $1 and branch_id = $2`,
    [vendorId, branchId],
  );

  await client.query(
    `delete from public.payments where vendor_id = $1 and branch_id = $2`,
    [vendorId, branchId],
  );
  await client.query(
    `delete from public.donations where vendor_id = $1 and branch_id = $2`,
    [vendorId, branchId],
  );

  await client.query(
    `delete from public.fee_dues where vendor_id = $1 and branch_id = $2`,
    [vendorId, branchId],
  );

  await client.query(
    `delete from public.class_enrollments
     where class_id in (select id from public.classes where branch_id = $1)`,
    [branchId],
  );

  await client.query(
    `delete from public.attendance_sessions
     where vendor_id = $1 and branch_id = $2`,
    [vendorId, branchId],
  );

  await client.query(
    `delete from public.islamic_progress_logs
     where vendor_id = $1 and branch_id = $2`,
    [vendorId, branchId],
  );

  await client.query(
    `delete from public.parent_access_tokens
     where student_id in (
       select id from public.students where vendor_id = $1 and branch_id = $2
     )`,
    [vendorId, branchId],
  );

  await client.query(
    `delete from public.whatsapp_messages
     where vendor_id = $1
       and (student_id is null or student_id in (
         select id from public.students where vendor_id = $1 and branch_id = $2
       ))`,
    [vendorId, branchId],
  );

  await client.query(
    `delete from public.student_fee_plans
     where student_id in (
       select id from public.students where vendor_id = $1 and branch_id = $2
     )`,
    [vendorId, branchId],
  );

  await client.query(
    `delete from public.student_health_info
     where student_id in (
       select id from public.students where vendor_id = $1 and branch_id = $2
     )`,
    [vendorId, branchId],
  );

  const delStudents = await client.query(
    `delete from public.students where vendor_id = $1 and branch_id = $2`,
    [vendorId, branchId],
  );
  console.log(`Deleted ${delStudents.rowCount ?? 0} students`);

  // Remove empty classes for this branch so we recreate cleanly from Excel
  await client.query(`delete from public.classes where branch_id = $1`, [
    branchId,
  ]);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const paymentsOnly = process.argv.includes("--payments-only");
  const wipe =
    !paymentsOnly && (process.argv.includes("--wipe") || !dryRun);
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL missing in .env.local");
    process.exit(1);
  }

  const excelPath = resolveExcelPath();
  console.log(`Excel: ${excelPath}`);

  const parsed = loadExcel(excelPath);
  const remaps = parsed.filter((r) => r.remappedFrom);
  const active = parsed.filter((r) => r.status === "active");
  const left = parsed.filter((r) => r.status === "left");
  const withPay = parsed.filter((r) => r.augustPayment > 0);
  const sumPending = active.reduce((s, r) => s + r.totalPending, 0);
  const sumPayments = withPay.reduce((s, r) => s + r.augustPayment, 0);

  console.log(
    `Loaded ${parsed.length} rows (${active.length} active, ${left.length} left)`,
  );
  console.log(`Active total pending sum: ${sumPending}`);
  console.log(
    `August payment rows: ${withPay.length} · sum paid: ${sumPayments}`,
  );
  if (remaps.length) {
    console.log(
      "Duplicate Index remaps:",
      remaps
        .map((r) => `${r.remappedFrom} → ${r.admissionNo} (${r.fullName})`)
        .join("; "),
    );
  }

  const sample = parsed.find((r) => r.admissionNo === "595");
  if (sample) {
    const carried = Math.max(0, sample.totalPending - MONTHLY_AMOUNT);
    console.log(
      `Sample 595 ${sample.fullName}: totalPending=${sample.totalPending} → pendingMonths=${sample.pendingMonths} · augustPayment=${sample.augustPayment} · paidBy=${sample.paidBy} → carried=${carried} + month=${MONTHLY_AMOUNT}`,
    );
  }

  if (dryRun) {
    const byClass = new Map<string, number>();
    for (const r of active) {
      byClass.set(r.className, (byClass.get(r.className) ?? 0) + 1);
    }
    console.log("Active by class:", Object.fromEntries(byClass));
    if (withPay.length) {
      console.log(
        "Sample payments:",
        withPay
          .slice(0, 5)
          .map(
            (r) =>
              `${r.admissionNo} ${r.fullName}: ${r.augustPayment} by ${r.paidBy}`,
          )
          .join("; "),
      );
    } else {
      console.log(
        "No August payment amounts in Excel (column empty). Fill “August payment” (+ optional Paid by) then re-run.",
      );
    }
    console.log(
      paymentsOnly
        ? "DRY RUN — payments-only (no DB writes)."
        : "DRY RUN — no DB writes. Pass without --dry-run to wipe+import.",
    );
    return;
  }

  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    await client.query("begin");

    const vendorRes = await client.query<{ id: string; name: string }>(
      `select id, name from public.vendors where lower(name) = lower($1) limit 1`,
      [VENDOR_NAME],
    );
    if (!vendorRes.rows[0]) throw new Error(`Vendor not found: ${VENDOR_NAME}`);
    const vendorId = vendorRes.rows[0].id;

    const branchRes = await client.query<{ id: string; name: string }>(
      `select id, name from public.branches where vendor_id = $1 and lower(name) = lower($2) limit 1`,
      [vendorId, BRANCH_NAME],
    );
    if (!branchRes.rows[0]) throw new Error(`Branch not found: ${BRANCH_NAME}`);
    const branchId = branchRes.rows[0].id;

    console.log(
      `Vendor ${vendorRes.rows[0].name} / branch ${branchRes.rows[0].name}`,
    );

    const recorderId = await resolveRecorderId(client, vendorId);

    if (paymentsOnly) {
      let paymentsInserted = 0;
      let skipped = 0;
      for (const row of withPay) {
        const st = await client.query<{ id: string }>(
          `select id from public.students
           where vendor_id = $1 and branch_id = $2 and admission_no = $3
           limit 1`,
          [vendorId, branchId, row.admissionNo],
        );
        if (!st.rows[0]) {
          console.warn(`No student for admission ${row.admissionNo}`);
          skipped++;
          continue;
        }
        const studentId = st.rows[0].id;
        const due = await client.query<{ id: string }>(
          `select id from public.fee_dues
           where student_id = $1 and due_month = $2 and due_year = $3
           limit 1`,
          [studentId, DUE_MONTH, DUE_YEAR],
        );
        const ok = await importPaymentForStudent(client, {
          vendorId,
          branchId,
          studentId,
          feeDueId: due.rows[0]?.id ?? null,
          amount: row.augustPayment,
          recordedBy: recorderId,
          paidBy: row.paidBy,
        });
        if (ok) paymentsInserted++;
      }
      await client.query("commit");
      console.log(
        JSON.stringify({ mode: "payments-only", paymentsInserted, skipped }, null, 2),
      );
      return;
    }

    if (!wipe) {
      console.error(
        "Refusing live import without wipe. Use --wipe or --payments-only.",
      );
      process.exit(1);
    }

    await wipeVendorBranch(client, vendorId, branchId);

    const classIds = new Map<string, string>();
    const neededClasses = [...new Set(parsed.map((r) => r.className))];
    for (const name of neededClasses) {
      const inserted = await client.query<{ id: string }>(
        `insert into public.classes (vendor_id, branch_id, name, is_active)
         values ($1, $2, $3, true)
         returning id`,
        [vendorId, branchId, name],
      );
      classIds.set(name, inserted.rows[0].id);
      console.log(`Created class ${name}`);
    }

    let studentsInserted = 0;
    let plansInserted = 0;
    let duesInserted = 0;
    let enrollmentsInserted = 0;
    let paymentsInserted = 0;

    for (const row of parsed) {
      const inserted = await client.query<{ id: string }>(
        `insert into public.students (
           vendor_id, branch_id, admission_no, full_name,
           guardian_name, guardian_phone, address, status
         ) values ($1,$2,$3,$4,$5,$6,$7,$8)
         returning id`,
        [
          vendorId,
          branchId,
          row.admissionNo,
          row.fullName,
          DEFAULT_GUARDIAN,
          row.phone,
          row.address,
          row.status,
        ],
      );
      const studentId = inserted.rows[0].id;
      studentsInserted++;

      await client.query(
        `insert into public.student_health_info (student_id) values ($1)
         on conflict (student_id) do nothing`,
        [studentId],
      );

      if (row.status === "active") {
        await client.query(
          `insert into public.student_fee_plans (
             student_id, monthly_amount, is_free, discount_percent, is_current, effective_from
           ) values ($1, $2, false, 0, true, current_date)`,
          [studentId, MONTHLY_AMOUNT],
        );
        plansInserted++;

        const totalDue = row.totalPending;
        const monthAmount = MONTHLY_AMOUNT;
        const carried = Math.max(0, totalDue - monthAmount);
        const dueStatus = totalDue <= 0 ? "paid" : "unpaid";

        const dueIns = await client.query<{ id: string }>(
          `insert into public.fee_dues (
             student_id, vendor_id, branch_id, due_month, due_year,
             month_amount, carried_forward, total_due, amount_paid, status
           ) values ($1,$2,$3,$4,$5,$6,$7,$8,0,$9)
           returning id`,
          [
            studentId,
            vendorId,
            branchId,
            DUE_MONTH,
            DUE_YEAR,
            monthAmount,
            carried,
            totalDue,
            dueStatus,
          ],
        );
        duesInserted++;
        const feeDueId = dueIns.rows[0].id;

        if (row.augustPayment > 0) {
          const ok = await importPaymentForStudent(client, {
            vendorId,
            branchId,
            studentId,
            feeDueId,
            amount: row.augustPayment,
            recordedBy: recorderId,
            paidBy: row.paidBy,
          });
          if (ok) paymentsInserted++;
        }

        const classId = classIds.get(row.className);
        if (classId) {
          await client.query(
            `insert into public.class_enrollments (class_id, student_id, is_active)
             values ($1, $2, true)
             on conflict (class_id, student_id) do update set is_active = true, left_at = null`,
            [classId, studentId],
          );
          enrollmentsInserted++;
        }
      }
    }

    await client.query("commit");

    console.log(
      JSON.stringify(
        {
          studentsInserted,
          plansInserted,
          duesInserted,
          enrollmentsInserted,
          paymentsInserted,
          classes: neededClasses.length,
          activeTotalPending: sumPending,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
