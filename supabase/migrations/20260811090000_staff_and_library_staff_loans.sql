-- Staff members (non-login directory) + library loans to staff

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  full_name text not null,
  staff_code text,
  phone text,
  email text,
  role_title text,
  address text,
  status text not null default 'active'
    check (status in ('active', 'left')),
  notes text,
  created_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists staff_members_vendor_code_uidx
  on public.staff_members (vendor_id, staff_code)
  where staff_code is not null and staff_code <> '';

create index if not exists idx_staff_members_branch
  on public.staff_members (vendor_id, branch_id);

-- Allow library loans to student OR staff
alter table public.library_loans
  alter column student_id drop not null;

alter table public.library_loans
  add column if not exists staff_id uuid references public.staff_members (id) on delete restrict;

do $$
begin
  alter table public.library_loans
    add constraint library_loans_borrower_chk
    check (
      (student_id is not null and staff_id is null)
      or (student_id is null and staff_id is not null)
    );
exception when duplicate_object then null;
end $$;

create index if not exists idx_library_loans_staff
  on public.library_loans (staff_id, borrowed_at desc);

alter table public.staff_members enable row level security;

drop policy if exists staff_members_select on public.staff_members;
drop policy if exists staff_members_write on public.staff_members;

create policy staff_members_select on public.staff_members for select to authenticated
  using (
    private.same_vendor(vendor_id)
    and (
      private.is_super_admin()
      or private.current_role() = 'vendor_admin'
      or branch_id = private.current_branch_id()
    )
  );

create policy staff_members_write on public.staff_members for all to authenticated
  using (
    private.can_manage_branch(vendor_id, branch_id)
    and private.current_role() in ('super_admin', 'vendor_admin', 'principal', 'data_entry')
  )
  with check (
    private.can_manage_branch(vendor_id, branch_id)
    and private.current_role() in ('super_admin', 'vendor_admin', 'principal', 'data_entry')
  );

revoke all on table public.staff_members from anon, public;
grant select, insert, update, delete on public.staff_members to authenticated;
