-- Return all active login accounts for a phone (no silent limit 1).
-- Callers must disambiguate when more than one row is returned.

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
  order by u.created_at asc;
$$;

revoke all on function public.lookup_app_user_by_phone(text) from public, anon, authenticated;
grant execute on function public.lookup_app_user_by_phone(text) to service_role;
