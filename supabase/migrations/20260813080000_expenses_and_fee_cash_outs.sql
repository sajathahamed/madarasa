-- Madarasa expenses + fee cash drawer movements

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  category text not null check (category in (
    'salary',
    'utilities',
    'food_kitchen',
    'maintenance',
    'books_stationery',
    'transport',
    'charity_zakat',
    'miscellaneous'
  )),
  title text not null,
  amount numeric(12,2) not null check (amount > 0),
  expense_date date not null default current_date,
  payee text,
  payment_method text not null default 'cash' check (payment_method in ('cash', 'bank')),
  notes text,
  created_by uuid not null references public.app_users (id),
  created_at timestamptz not null default now()
);

create index if not exists expenses_vendor_branch_date_idx
  on public.expenses (vendor_id, branch_id, expense_date desc);

create index if not exists expenses_category_idx
  on public.expenses (vendor_id, branch_id, category);

comment on table public.expenses is
  'Day-to-day madarasa expense tracking (salaries, utilities, kitchen, etc.)';

-- Cash taken out of the fee till / drawer (audit trail)
create table if not exists public.fee_cash_outs (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  reason text not null,
  cashed_out_by uuid not null references public.app_users (id),
  cashed_out_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists fee_cash_outs_vendor_branch_at_idx
  on public.fee_cash_outs (vendor_id, branch_id, cashed_out_at desc);

comment on table public.fee_cash_outs is
  'Cash withdrawn from fee collections drawer; cash on hand ≈ approved cash payments − cash outs − cash expenses';

alter table public.expenses enable row level security;
alter table public.fee_cash_outs enable row level security;

drop policy if exists expenses_select on public.expenses;
drop policy if exists expenses_insert on public.expenses;
drop policy if exists expenses_update on public.expenses;
drop policy if exists expenses_delete on public.expenses;

create policy expenses_select on public.expenses for select to authenticated
  using (
    private.same_vendor(vendor_id)
    and (
      private.is_super_admin()
      or private.current_role() = 'vendor_admin'
      or branch_id = private.current_branch_id()
    )
  );

create policy expenses_insert on public.expenses for insert to authenticated
  with check (
    private.same_vendor(vendor_id)
    and private.current_role() in ('super_admin', 'vendor_admin', 'data_entry')
    and (private.current_role() in ('super_admin', 'vendor_admin') or branch_id = private.current_branch_id())
    and created_by = auth.uid()
  );

create policy expenses_update on public.expenses for update to authenticated
  using (
    private.same_vendor(vendor_id)
    and private.current_role() in ('super_admin', 'vendor_admin', 'data_entry')
    and (private.current_role() in ('super_admin', 'vendor_admin') or branch_id = private.current_branch_id())
  )
  with check (
    private.same_vendor(vendor_id)
    and private.current_role() in ('super_admin', 'vendor_admin', 'data_entry')
    and (private.current_role() in ('super_admin', 'vendor_admin') or branch_id = private.current_branch_id())
  );

create policy expenses_delete on public.expenses for delete to authenticated
  using (
    private.same_vendor(vendor_id)
    and private.current_role() in ('super_admin', 'vendor_admin')
  );

drop policy if exists fee_cash_outs_select on public.fee_cash_outs;
drop policy if exists fee_cash_outs_insert on public.fee_cash_outs;
drop policy if exists fee_cash_outs_delete on public.fee_cash_outs;

create policy fee_cash_outs_select on public.fee_cash_outs for select to authenticated
  using (
    private.same_vendor(vendor_id)
    and (
      private.is_super_admin()
      or private.current_role() = 'vendor_admin'
      or branch_id = private.current_branch_id()
    )
  );

create policy fee_cash_outs_insert on public.fee_cash_outs for insert to authenticated
  with check (
    private.same_vendor(vendor_id)
    and private.current_role() in ('super_admin', 'vendor_admin', 'data_entry')
    and (private.current_role() in ('super_admin', 'vendor_admin') or branch_id = private.current_branch_id())
    and cashed_out_by = auth.uid()
  );

create policy fee_cash_outs_delete on public.fee_cash_outs for delete to authenticated
  using (
    private.same_vendor(vendor_id)
    and private.current_role() in ('super_admin', 'vendor_admin')
  );

revoke all on table public.expenses from anon, public;
revoke all on table public.fee_cash_outs from anon, public;
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, update, delete on public.fee_cash_outs to authenticated;
grant select, insert, update, delete on public.expenses to service_role;
grant select, insert, update, delete on public.fee_cash_outs to service_role;
