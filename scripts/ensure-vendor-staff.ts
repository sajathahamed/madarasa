/**
 * Ensure eravur markaz staff via Postgres (same pattern as create-super-admin-sql.ts):
 *   - akram  → vendor_admin (Admin), branch_id null
 *   - fiham  → data_entry on main
 *
 * Usage: npx tsx scripts/ensure-vendor-staff.ts
 * Prints temporary passwords (not stored in repo).
 */
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

const VENDOR_NAME = "eravur markaz";
const BRANCH_NAME = "main";

type StaffSpec = {
  email: string;
  full_name: string;
  role: "vendor_admin" | "data_entry";
  whatsapp: string;
  phone: string;
  needsBranch: boolean;
};

const STAFF: StaffSpec[] = [
  {
    email: "akram@gmail.com",
    full_name: "akram",
    role: "vendor_admin",
    whatsapp: "0773529674",
    phone: "0758820268",
    needsBranch: false,
  },
  {
    email: "fiham@gmail.com",
    full_name: "fiham",
    role: "data_entry",
    whatsapp: "0773529674",
    phone: "0758820268",
    needsBranch: true,
  },
];

function randomPassword() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function upsertAuthUser(
  client: pg.Client,
  email: string,
  password: string,
  fullName: string,
  role: string,
) {
  const existing = await client.query(
    `select id from auth.users where email = $1`,
    [email],
  );

  let userId: string;
  if (existing.rows[0]) {
    userId = existing.rows[0].id as string;
    await client.query(
      `update auth.users
       set encrypted_password = crypt($1, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
             || jsonb_build_object('provider','email','providers', jsonb_build_array('email'), 'role', $2::text),
           raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
             || $3::jsonb,
           updated_at = now()
       where id = $4`,
      [password, role, JSON.stringify({ full_name: fullName }), userId],
    );
  } else {
    const inserted = await client.query(
      `insert into auth.users (
         instance_id, id, aud, role, email, encrypted_password,
         email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
         created_at, updated_at, confirmation_token, email_change,
         email_change_token_new, recovery_token
       ) values (
         '00000000-0000-0000-0000-000000000000',
         gen_random_uuid(),
         'authenticated',
         'authenticated',
         $1,
         crypt($2, gen_salt('bf')),
         now(),
         jsonb_build_object('provider','email','providers', jsonb_build_array('email'), 'role', $3::text),
         $4::jsonb,
         now(),
         now(),
         '',
         '',
         '',
         ''
       )
       returning id`,
      [email, password, role, JSON.stringify({ full_name: fullName })],
    );
    userId = inserted.rows[0].id as string;
  }

  const identity = await client.query(
    `select id from auth.identities where user_id = $1 and provider = 'email'`,
    [userId],
  );
  if (!identity.rows[0]) {
    await client.query(
      `insert into auth.identities (
         id, user_id, identity_data, provider, provider_id,
         last_sign_in_at, created_at, updated_at
       ) values (
         gen_random_uuid(),
         $1::uuid,
         jsonb_build_object('sub', $2::text, 'email', $3::text, 'email_verified', true),
         'email',
         $2::text,
         now(),
         now(),
         now()
       )`,
      [userId, userId, email],
    );
  }

  return userId;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing in .env.local");

  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const credentials: Array<{
    email: string;
    password: string;
    role: string;
    action: string;
  }> = [];

  try {
    await client.query("begin");

    const { rows: vendors } = await client.query(
      `select id, name from public.vendors where lower(name) = lower($1) limit 1`,
      [VENDOR_NAME],
    );
    if (!vendors[0]) throw new Error(`Vendor not found: ${VENDOR_NAME}`);
    const vendorId = vendors[0].id as string;

    const { rows: branches } = await client.query(
      `select id, name from public.branches where vendor_id = $1 and lower(name) = lower($2) limit 1`,
      [vendorId, BRANCH_NAME],
    );
    if (!branches[0]) throw new Error(`Branch not found: ${BRANCH_NAME}`);
    const branchId = branches[0].id as string;

    console.log(`Vendor: ${VENDOR_NAME} (${vendorId})`);
    console.log(`Branch: ${BRANCH_NAME} (${branchId})\n`);

    for (const person of STAFF) {
      const existed = await client.query(
        `select id from auth.users where email = $1`,
        [person.email],
      );
      const action = existed.rows[0] ? "updated" : "created";
      const password = randomPassword();
      const userId = await upsertAuthUser(
        client,
        person.email,
        password,
        person.full_name,
        person.role,
      );

      await client.query(
        `insert into public.app_users (
           id, full_name, role, vendor_id, branch_id, phone, whatsapp_number, status
         ) values (
           $1, $2, $3::public.user_role, $4, $5, $6, $7, 'active'
         )
         on conflict (id) do update set
           full_name = excluded.full_name,
           role = excluded.role,
           vendor_id = excluded.vendor_id,
           branch_id = excluded.branch_id,
           phone = excluded.phone,
           whatsapp_number = excluded.whatsapp_number,
           status = 'active'`,
        [
          userId,
          person.full_name,
          person.role,
          vendorId,
          person.needsBranch ? branchId : null,
          person.phone,
          person.whatsapp,
        ],
      );

      credentials.push({
        email: person.email,
        password,
        role: person.role,
        action,
      });
      console.log(
        `${action} ${person.full_name} <${person.email}> as ${person.role}`,
      );
    }

    await client.query("commit");

    const { rows: staff } = await client.query(
      `
      select a.full_name, a.role::text, a.status, u.email, b.name as branch
      from public.app_users a
      left join auth.users u on u.id = a.id
      left join public.branches b on b.id = a.branch_id
      where a.vendor_id = $1
      order by a.role, a.full_name
      `,
      [vendorId],
    );
    console.log("\nCurrent eravur markaz staff:");
    console.table(staff);

    console.log("\n=== LOGIN CREDENTIALS (temporary) ===");
    for (const c of credentials) {
      console.log(
        `${c.email} | password: ${c.password} | role: ${c.role} (${c.action})`,
      );
    }
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
