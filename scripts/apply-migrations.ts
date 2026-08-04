/**
 * Apply all SQL migrations in supabase/migrations to DATABASE_URL from .env.local
 * Usage: npx tsx scripts/apply-migrations.ts
 */
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL missing in .env.local");
    process.exit(1);
  }

  const dir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  console.log(`Connecting… (${files.length} migrations)`);
  await client.connect();
  console.log("Connected.");

  try {
    for (const file of files) {
      const sql = readFileSync(join(dir, file), "utf8");
      console.log(`Applying ${file}…`);
      await client.query(sql);
      console.log(`OK ${file}`);
    }

    const { rows } = await client.query(
      `select table_name from information_schema.tables
       where table_schema = 'public' order by table_name`,
    );
    console.log(
      "Tables:",
      rows.map((r: { table_name: string }) => r.table_name).join(", "),
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
