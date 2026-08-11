/**
 * Wipe eravur markaz student/fee data and re-import from
 * "Monthly Fee mangent EDIT.xlsx".
 *
 * Amount source: column "Total pending" (already includes August).
 * pendingMonths = totalPending / 12000 (display; money stays exact).
 * fee_dues: total_due = totalPending, month_amount = 12000,
 *           carried_forward = max(0, totalPending - 12000).
 *
 * Usage:
 *   npx tsx scripts/import-markas-excel.ts --dry-run
 *   npx tsx scripts/import-markas-excel.ts --wipe
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

  const seen = new Map<string, number>();
  const out: ParsedRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const indexRaw = row[1];
    const nameRaw = row[2];
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

    // New sheet columns:
    // 6 Pending Months, 7 BALANCE ON 30.07, 8 August, 9 Total pending, 10 Aug payment, 11 Balance
    const left =
      isLeftMarker(row[6]) ||
      isLeftMarker(row[7]) ||
      isLeftMarker(row[9]) ||
      isLeftMarker(row[11]);

    const totalPendingRaw =
      parseMoney(row[9]) ??
      parseMoney(row[11]) ??
      (parseMoney(row[7]) != null && parseMoney(row[8]) != null
        ? (parseMoney(row[7]) as number) + (parseMoney(row[8]) as number)
        : null) ??
      0;
    const totalPending = left ? 0 : Math.max(0, totalPendingRaw);
    const excelPendingMonths = left ? null : parseMoney(row[6]);

    const gradeRaw = (row[3] ?? "") as string | number;

    out.push({
      excelIndex,
      admissionNo,
      fullName,
      gradeRaw,
      className: classNameFromGrade(gradeRaw),
      address:
        row[4] != null && String(row[4]).trim() ? String(row[4]).trim() : null,
      phone: parsePhone(row[5]),
      totalPending,
      pendingMonths: monthsFromPending(totalPending),
      excelPendingMonths,
      status: left ? "left" : "active",
      remappedFrom: remapped ? excelIndex : undefined,
    });
  }

  return out;
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
  const wipe = process.argv.includes("--wipe") || !dryRun;
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
  const sumPending = active.reduce((s, r) => s + r.totalPending, 0);

  console.log(
    `Loaded ${parsed.length} rows (${active.length} active, ${left.length} left)`,
  );
  console.log(`Active total pending sum: ${sumPending}`);
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
      `Sample 595 ${sample.fullName}: totalPending=${sample.totalPending} → pendingMonths=${sample.pendingMonths} (excel col=${sample.excelPendingMonths ?? "—"}) → carried=${carried} + month=${MONTHLY_AMOUNT}`,
    );
  }

  // Cross-check: Excel "Pending Months" vs derived (log mismatches only)
  const mismatches = active.filter(
    (r) =>
      r.excelPendingMonths != null &&
      Math.abs(r.excelPendingMonths - r.pendingMonths) > 0.05,
  );
  if (mismatches.length) {
    console.log(
      `Pending-months mismatches (excel vs total/12000): ${mismatches.length} (showing up to 5)`,
    );
    for (const r of mismatches.slice(0, 5)) {
      console.log(
        `  ${r.admissionNo} ${r.fullName}: excel=${r.excelPendingMonths} derived=${r.pendingMonths} total=${r.totalPending}`,
      );
    }
  }

  if (dryRun) {
    const byClass = new Map<string, number>();
    for (const r of active) {
      byClass.set(r.className, (byClass.get(r.className) ?? 0) + 1);
    }
    console.log("Active by class:", Object.fromEntries(byClass));
    console.log("DRY RUN — no DB writes. Pass without --dry-run to wipe+import.");
    return;
  }

  if (!wipe) {
    console.error("Refusing live import without wipe. Use --wipe (default for live).");
    process.exit(1);
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
        const dueStatus =
          totalDue <= 0 ? "paid" : "unpaid";

        await client.query(
          `insert into public.fee_dues (
             student_id, vendor_id, branch_id, due_month, due_year,
             month_amount, carried_forward, total_due, amount_paid, status
           ) values ($1,$2,$3,$4,$5,$6,$7,$8,0,$9)`,
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
