/**
 * Import Monthly Fee mangent.xlsx into vendor "eravur markaz" / branch "main".
 *
 * Usage:
 *   npx tsx scripts/import-markas-excel.ts --dry-run
 *   npx tsx scripts/import-markas-excel.ts
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
const EXCEL_PATH = join(process.cwd(), "Monthly Fee mangent.xlsx");

type ParsedRow = {
  excelIndex: string;
  admissionNo: string;
  fullName: string;
  gradeRaw: string | number;
  className: string;
  address: string | null;
  phone: string;
  balance: number;
  status: "active" | "left";
  remappedFrom?: string;
};

function classNameFromGrade(grade: string | number): string {
  if (typeof grade === "string" && grade.trim().toLowerCase() === "hifz") {
    return "Hifz";
  }
  const n = Number(grade);
  if (!Number.isNaN(n) && n >= 1 && n <= 6) return `Grade ${n}`;
  return `Grade ${String(grade).trim()}`;
}

function parsePhone(raw: unknown): string {
  if (raw == null || raw === "") return DEFAULT_PHONE;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 8) return DEFAULT_PHONE;
  return digits;
}

function parseBalance(raw: unknown): {
  balance: number;
  status: "active" | "left";
} {
  if (raw == null || raw === "") return { balance: 0, status: "active" };
  if (typeof raw === "string" && raw.toLowerCase().includes("left")) {
    return { balance: 0, status: "left" };
  }
  const n = Number(raw);
  if (Number.isNaN(n)) return { balance: 0, status: "active" };
  return { balance: n, status: "active" };
}

function loadExcel(): ParsedRow[] {
  if (!existsSync(EXCEL_PATH)) {
    throw new Error(`Excel not found: ${EXCEL_PATH}`);
  }
  const wb = XLSX.readFile(EXCEL_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
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

    const { balance, status } = parseBalance(row[6]);
    const gradeRaw = (row[3] ?? "") as string | number;

    out.push({
      excelIndex,
      admissionNo,
      fullName,
      gradeRaw,
      className: classNameFromGrade(gradeRaw),
      address: row[4] != null && String(row[4]).trim() ? String(row[4]).trim() : null,
      phone: parsePhone(row[5]),
      balance,
      status,
      remappedFrom: remapped ? excelIndex : undefined,
    });
  }

  return out;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL missing in .env.local");
    process.exit(1);
  }

  const parsed = loadExcel();
  const remaps = parsed.filter((r) => r.remappedFrom);
  const active = parsed.filter((r) => r.status === "active");
  const left = parsed.filter((r) => r.status === "left");

  console.log(`Loaded ${parsed.length} rows (${active.length} active, ${left.length} left)`);
  if (remaps.length) {
    console.log(
      "Duplicate Index remaps:",
      remaps.map((r) => `${r.remappedFrom} → ${r.admissionNo} (${r.fullName})`).join("; "),
    );
  }

  const sample = parsed.find((r) => r.admissionNo === "595");
  if (sample) {
    console.log(
      `Sample 595 ${sample.fullName}: carried=${sample.balance} + month=${MONTHLY_AMOUNT} → total=${sample.balance + MONTHLY_AMOUNT}`,
    );
  }

  if (dryRun) {
    const byClass = new Map<string, number>();
    for (const r of active) {
      byClass.set(r.className, (byClass.get(r.className) ?? 0) + 1);
    }
    console.log("Active by class:", Object.fromEntries(byClass));
    console.log("DRY RUN — no DB writes.");
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

    console.log(`Vendor ${vendorRes.rows[0].name} / branch ${branchRes.rows[0].name}`);

    // Ensure classes
    const classIds = new Map<string, string>();
    const neededClasses = [...new Set(parsed.map((r) => r.className))];
    for (const name of neededClasses) {
      const existing = await client.query<{ id: string }>(
        `select id from public.classes where branch_id = $1 and name = $2 limit 1`,
        [branchId, name],
      );
      if (existing.rows[0]) {
        classIds.set(name, existing.rows[0].id);
        continue;
      }
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
    let studentsUpdated = 0;
    let plansInserted = 0;
    let duesInserted = 0;
    let enrollmentsInserted = 0;

    for (const row of parsed) {
      const existing = await client.query<{ id: string }>(
        `select id from public.students
         where vendor_id = $1 and branch_id = $2 and admission_no = $3
         limit 1`,
        [vendorId, branchId, row.admissionNo],
      );

      let studentId: string;
      if (existing.rows[0]) {
        studentId = existing.rows[0].id;
        await client.query(
          `update public.students set
             full_name = $1,
             guardian_name = coalesce(nullif(guardian_name, ''), $2),
             guardian_phone = case when guardian_phone is null or guardian_phone = '' or guardian_phone = $3
                                  then $4 else guardian_phone end,
             address = coalesce($5, address),
             status = $6
           where id = $7`,
          [
            row.fullName,
            DEFAULT_GUARDIAN,
            DEFAULT_PHONE,
            row.phone,
            row.address,
            row.status,
            studentId,
          ],
        );
        studentsUpdated++;
      } else {
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
        studentId = inserted.rows[0].id;
        studentsInserted++;

        await client.query(
          `insert into public.student_health_info (student_id) values ($1)
           on conflict (student_id) do nothing`,
          [studentId],
        );
      }

      if (row.status === "active") {
        const plan = await client.query<{ id: string }>(
          `select id from public.student_fee_plans
           where student_id = $1 and is_current = true
           limit 1`,
          [studentId],
        );
        if (plan.rows[0]) {
          await client.query(
            `update public.student_fee_plans
             set monthly_amount = $1, is_free = false, discount_percent = 0
             where id = $2`,
            [MONTHLY_AMOUNT, plan.rows[0].id],
          );
        } else {
          await client.query(
            `insert into public.student_fee_plans (
               student_id, monthly_amount, is_free, discount_percent, is_current, effective_from
             ) values ($1, $2, false, 0, true, current_date)`,
            [studentId, MONTHLY_AMOUNT],
          );
          plansInserted++;
        }

        const carried = row.balance;
        const monthAmount = MONTHLY_AMOUNT;
        const totalDue = carried + monthAmount;
        const dueStatus = totalDue <= 0 ? "paid" : "unpaid";

        const dueExists = await client.query<{ id: string }>(
          `select id from public.fee_dues
           where student_id = $1 and due_month = $2 and due_year = $3
           limit 1`,
          [studentId, DUE_MONTH, DUE_YEAR],
        );
        if (!dueExists.rows[0]) {
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
        }

        const classId = classIds.get(row.className);
        if (classId) {
          const en = await client.query(
            `insert into public.class_enrollments (class_id, student_id, is_active)
             values ($1, $2, true)
             on conflict (class_id, student_id) do update set is_active = true, left_at = null
             returning (xmax = 0) as inserted`,
            [classId, studentId],
          );
          if (en.rows[0]?.inserted) enrollmentsInserted++;
        }
      }
    }

    await client.query("commit");

    console.log(
      JSON.stringify(
        {
          studentsInserted,
          studentsUpdated,
          plansInserted,
          duesInserted,
          enrollmentsInserted,
          classes: neededClasses.length,
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
