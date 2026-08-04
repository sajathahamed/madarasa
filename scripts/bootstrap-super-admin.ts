/**
 * Bootstrap the first super_admin.
 * Usage:
 *   npx tsx scripts/bootstrap-super-admin.ts email@example.com "Full Name" +9477xxxxxxx [password]
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const [email, fullName, whatsapp, passwordArg] = process.argv.slice(2);
  if (!email || !fullName || !whatsapp) {
    console.error(
      'Usage: npx tsx scripts/bootstrap-super-admin.ts email "Full Name" +94... [password]',
    );
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const password =
    passwordArg ||
    Array.from({ length: 12 }, () =>
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"[
        Math.floor(Math.random() * 58)
      ],
    ).join("");

  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: "super_admin" },
      user_metadata: { full_name: fullName },
    });

  if (authError || !authData.user) {
    console.error(authError?.message ?? "Auth create failed");
    process.exit(1);
  }

  const { error: profileError } = await admin.from("app_users").insert({
    id: authData.user.id,
    role: "super_admin",
    full_name: fullName,
    whatsapp_number: whatsapp,
    status: "active",
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    console.error(profileError.message);
    process.exit(1);
  }

  console.log("Super admin created:");
  console.log({ email, password, id: authData.user.id });
}

main();
