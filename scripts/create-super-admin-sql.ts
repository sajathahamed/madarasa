/**
 * Create super admin directly via Postgres (auth.users + app_users).
 * Usage: npx tsx scripts/create-super-admin-sql.ts
 */
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

const EMAIL = "easytech@gmail.com";
const FULL_NAME = "Easy Tech";
const WHATSAPP = "+94773529674";
const PASSWORD = "123456789";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL missing in .env.local");
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query("begin");

    const existing = await client.query(
      `select id from auth.users where email = $1`,
      [EMAIL],
    );

    let userId: string;

    if (existing.rows[0]) {
      userId = existing.rows[0].id as string;
      await client.query(
        `update auth.users
         set encrypted_password = crypt($1, gen_salt('bf')),
             email_confirmed_at = coalesce(email_confirmed_at, now()),
             raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"provider":"email","providers":["email"]}'::jsonb,
             raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || $2::jsonb,
             updated_at = now()
         where id = $3`,
        [PASSWORD, JSON.stringify({ full_name: FULL_NAME }), userId],
      );
      console.log("Updated existing auth user:", userId);
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
           '{"provider":"email","providers":["email"]}'::jsonb,
           $3::jsonb,
           now(),
           now(),
           '',
           '',
           '',
           ''
         )
         returning id`,
        [EMAIL, PASSWORD, JSON.stringify({ full_name: FULL_NAME })],
      );
      userId = inserted.rows[0].id as string;
      console.log("Created auth user:", userId);
    }

    // Ensure email identity exists (required by Supabase Auth)
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
        [userId, userId, EMAIL],
      );
      console.log("Created email identity");
    }

    await client.query(
      `insert into public.app_users (
         id, vendor_id, branch_id, role, full_name, phone, whatsapp_number, status
       ) values (
         $1, null, null, 'super_admin', $2, $3, $3, 'active'
       )
       on conflict (id) do update set
         role = 'super_admin',
         full_name = excluded.full_name,
         phone = excluded.phone,
         whatsapp_number = excluded.whatsapp_number,
         status = 'active',
         vendor_id = null,
         branch_id = null`,
      [userId, FULL_NAME, WHATSAPP],
    );

    await client.query("commit");
    console.log("Super admin ready:");
    console.log({ email: EMAIL, password: PASSWORD, whatsapp: WHATSAPP, id: userId });
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
