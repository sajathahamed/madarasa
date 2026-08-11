-- Phone-first password reset: normalize + look up login users by phone.

create or replace function public.normalize_phone_msisdn(p text)
returns text
language sql
immutable
as $$
  select case
    when d is null or d = '' then null
    when d ~ '^0' then '94' || substr(d, 2)
    when length(d) = 9 and d ~ '^7' then '94' || d
    else d
  end
  from (
    select nullif(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '') as d
  ) s;
$$;

revoke all on function public.normalize_phone_msisdn(text) from public, anon, authenticated;
grant execute on function public.normalize_phone_msisdn(text) to service_role;

-- Active app_users (login accounts) matching phone / whatsapp_number.
create or replace function public.lookup_app_user_by_phone(p_phone text)
returns table (id uuid, phone text, email text)
language sql
security definer
set search_path = auth, public
as $$
  with target as (
    select public.normalize_phone_msisdn(p_phone) as msisdn
  )
  select
    u.id,
    coalesce(
      public.normalize_phone_msisdn(u.phone),
      public.normalize_phone_msisdn(u.whatsapp_number)
    ) as phone,
    au.email::text
  from public.app_users u
  join auth.users au on au.id = u.id
  cross join target t
  where u.status = 'active'
    and t.msisdn is not null
    and (
      public.normalize_phone_msisdn(u.phone) = t.msisdn
      or public.normalize_phone_msisdn(u.whatsapp_number) = t.msisdn
    )
  order by u.created_at asc
  limit 1;
$$;

revoke all on function public.lookup_app_user_by_phone(text) from public, anon, authenticated;
grant execute on function public.lookup_app_user_by_phone(text) to service_role;

-- Staff directory phone match (no login account).
create or replace function public.staff_phone_exists(p_phone text)
returns boolean
language sql
security definer
set search_path = public
as $$
  with target as (
    select public.normalize_phone_msisdn(p_phone) as msisdn
  )
  select exists (
    select 1
    from public.staff_members s
    cross join target t
    where s.status = 'active'
      and t.msisdn is not null
      and public.normalize_phone_msisdn(s.phone) = t.msisdn
  );
$$;

revoke all on function public.staff_phone_exists(text) from public, anon, authenticated;
grant execute on function public.staff_phone_exists(text) to service_role;

create index if not exists password_reset_otps_phone_created_idx
  on public.password_reset_otps (phone, created_at desc);
