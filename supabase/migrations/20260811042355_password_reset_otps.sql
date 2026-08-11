-- Password reset OTPs (SMS). Accessed only via service role from server actions.

create table if not exists public.password_reset_otps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  phone text not null,
  code_hash text not null,
  attempts int not null default 0,
  max_attempts int not null default 5,
  expires_at timestamptz not null,
  verified_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_otps_email_created_idx
  on public.password_reset_otps (lower(email), created_at desc);

create index if not exists password_reset_otps_user_id_idx
  on public.password_reset_otps (user_id, created_at desc);

alter table public.password_reset_otps enable row level security;

-- No policies for anon/authenticated — service role only.
revoke all on table public.password_reset_otps from anon, authenticated, public;
grant select, insert, update, delete on table public.password_reset_otps to service_role;

-- Lookup auth user by email for password-reset flow (service role only).
create or replace function public.lookup_auth_user_by_email(p_email text)
returns table (id uuid, email text)
language sql
security definer
set search_path = auth, public
as $$
  select u.id, u.email::text
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

revoke all on function public.lookup_auth_user_by_email(text) from public, anon, authenticated;
grant execute on function public.lookup_auth_user_by_email(text) to service_role;
