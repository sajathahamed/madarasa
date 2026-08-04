# Madarasa

Multi-vendor madrasa management platform (Next.js + Supabase) with:

- Multi-tenant vendors / branches / roles
- Two-step payment & donation approval (accountant → principal)
- Double-entry ledger posting via Postgres triggers (atomic with approval)
- WhatsApp abstraction (`src/lib/whatsapp.ts`) for Meta or UltraMsg
- Monthly fee due generation cron (`/api/cron/generate-dues`)

## Stack

- Next.js 16 App Router + Server Actions + Tailwind + shadcn/ui
- Supabase Auth, Postgres, RLS
- Currency default: **LKR**

## Setup

1. Copy `.env.example` → `.env.local` (or use the existing one).
2. Paste **service_role** key from Supabase Dashboard → Project Settings → API into `SUPABASE_SERVICE_ROLE_KEY`.
3. Install & run:

```bash
npm install
npm run dev
```

4. Bootstrap the first super admin (requires service role key):

```bash
npx tsx scripts/bootstrap-super-admin.ts you@example.com "Your Name" +9477xxxxxxx
```

5. Sign in at `/login`, then create vendors, branches, and staff from `/super-admin`.

## Supabase project

- Project ref: `kkmlwcweuznhimqgroep`
- URL: `https://kkmlwcweuznhimqgroep.supabase.co`
- Uses publishable key (`sb_publishable_…`) in the app clients
- Schema + RLS + ledger triggers applied via `scripts/apply-migrations.ts`

## Roles

| Role | Scope |
|------|--------|
| `super_admin` | Platform |
| `vendor_admin` | One vendor |
| `data_entry` | One branch — students, payments, donations |
| `accountant` | One branch — first approval |
| `principal` | One branch — final approval → ledger post |

## Cron

Protect with `Authorization: Bearer $CRON_SECRET`.

Vercel schedule (1st of month 01:00 UTC) is in `vercel.json`.
