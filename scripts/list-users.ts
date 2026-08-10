/**
 * List auth emails joined with app_users roles.
 * Usage: npx tsx scripts/list-users.ts
 */
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");

  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const { rows } = await client.query(`
    select
      coalesce(u.email, '') as username,
      coalesce(a.full_name, '') as full_name,
      coalesce(a.role::text, '(no profile)') as role,
      coalesce(a.status, '') as status,
      a.phone,
      a.whatsapp_number,
      u.created_at
    from auth.users u
    left join public.app_users a on a.id = u.id
    order by a.role nulls last, u.email
  `);

  console.log(`Found ${rows.length} auth user(s):\n`);
  for (const r of rows) {
    console.log(
      [
        `username: ${r.username}`,
        `name: ${r.full_name || "—"}`,
        `role: ${r.role}`,
        `status: ${r.status || "—"}`,
        `phone: ${r.phone || "—"}`,
        `whatsapp: ${r.whatsapp_number || "—"}`,
      ].join(" | "),
    );
  }
  console.log(
    "\nNote: passwords are hashed in auth.users and cannot be read back as plain text.",
  );
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
