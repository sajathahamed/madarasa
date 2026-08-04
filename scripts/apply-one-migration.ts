/**
 * Apply a single migration file by name.
 * Usage: npx tsx scripts/apply-one-migration.ts 20260804210000_school_ops.sql
 */
import { readFileSync } from "fs";
import { join } from "path";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Pass migration filename");
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const sql = readFileSync(join(process.cwd(), "supabase", "migrations", file), "utf8");
  console.log(`Applying ${file}…`);
  await client.query(sql);
  console.log("OK");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
