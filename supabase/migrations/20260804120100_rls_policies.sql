-- RLS helpers + policies
create or replace function private.current_app_user()
returns public.app_users
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.app_users where id = auth.uid();
$$;

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_users
    where id = auth.uid() and role = 'super_admin' and status = 'active'
  );
$$;

create or replace function private.current_vendor_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select vendor_id from public.app_users where id = auth.uid();
$$;

create or replace function private.current_branch_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select branch_id from public.app_users where id = auth.uid();
$$;

create or replace function private.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.app_users where id = auth.uid();
$$;

create or replace function private.same_vendor(p_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_super_admin()
    or (p_vendor_id is not null and p_vendor_id = private.current_vendor_id());
$$;

grant execute on function private.current_app_user() to authenticated;
grant execute on function private.is_super_admin() to authenticated;
grant execute on function private.current_vendor_id() to authenticated;
grant execute on function private.current_branch_id() to authenticated;
grant execute on function private.current_role() to authenticated;
grant execute on function private.same_vendor(uuid) to authenticated;

alter table public.vendors enable row level security;
alter table public.branches enable row level security;
alter table public.app_users enable row level security;
alter table public.students enable row level security;
alter table public.student_health_info enable row level security;
alter table public.student_fee_plans enable row level security;
alter table public.fee_dues enable row level security;
alter table public.payments enable row level security;
alter table public.donations enable row level security;
alter table public.accounts enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists vendors_select on public.vendors;
drop policy if exists vendors_insert on public.vendors;
drop policy if exists vendors_update on public.vendors;
drop policy if exists vendors_delete on public.vendors;
create policy vendors_select on public.vendors for select to authenticated
  using (private.is_super_admin() or id = private.current_vendor_id());
create policy vendors_insert on public.vendors for insert to authenticated
  with check (private.is_super_admin());
create policy vendors_update on public.vendors for update to authenticated
  using (private.is_super_admin()) with check (private.is_super_admin());
create policy vendors_delete on public.vendors for delete to authenticated
  using (private.is_super_admin());

drop policy if exists branches_select on public.branches;
drop policy if exists branches_insert on public.branches;
drop policy if exists branches_update on public.branches;
drop policy if exists branches_delete on public.branches;
create policy branches_select on public.branches for select to authenticated
  using (private.same_vendor(vendor_id));
create policy branches_insert on public.branches for insert to authenticated
  with check (
    private.is_super_admin()
    or (private.current_role() = 'vendor_admin' and vendor_id = private.current_vendor_id())
  );
create policy branches_update on public.branches for update to authenticated
  using (
    private.is_super_admin()
    or (private.current_role() = 'vendor_admin' and vendor_id = private.current_vendor_id())
  )
  with check (
    private.is_super_admin()
    or (private.current_role() = 'vendor_admin' and vendor_id = private.current_vendor_id())
  );
create policy branches_delete on public.branches for delete to authenticated
  using (private.is_super_admin() or (private.current_role() = 'vendor_admin' and vendor_id = private.current_vendor_id()));

drop policy if exists app_users_select on public.app_users;
drop policy if exists app_users_insert on public.app_users;
drop policy if exists app_users_update on public.app_users;
create policy app_users_select on public.app_users for select to authenticated
  using (
    private.is_super_admin()
    or id = auth.uid()
    or (vendor_id is not null and vendor_id = private.current_vendor_id())
  );
create policy app_users_insert on public.app_users for insert to authenticated
  with check (
    private.is_super_admin()
    or (
      private.current_role() = 'vendor_admin'
      and vendor_id = private.current_vendor_id()
      and role in ('data_entry', 'accountant', 'principal', 'vendor_admin')
    )
  );
create policy app_users_update on public.app_users for update to authenticated
  using (
    private.is_super_admin()
    or id = auth.uid()
    or (private.current_role() = 'vendor_admin' and vendor_id = private.current_vendor_id())
  )
  with check (
    private.is_super_admin()
    or id = auth.uid()
    or (private.current_role() = 'vendor_admin' and vendor_id = private.current_vendor_id())
  );

drop policy if exists students_select on public.students;
drop policy if exists students_insert on public.students;
drop policy if exists students_update on public.students;
create policy students_select on public.students for select to authenticated
  using (
    private.same_vendor(vendor_id)
    and (
      private.current_role() in ('super_admin', 'vendor_admin')
      or branch_id = private.current_branch_id()
    )
  );
create policy students_insert on public.students for insert to authenticated
  with check (
    private.same_vendor(vendor_id)
    and private.current_role() in ('super_admin', 'vendor_admin', 'data_entry')
    and (
      private.current_role() in ('super_admin', 'vendor_admin')
      or branch_id = private.current_branch_id()
    )
  );
create policy students_update on public.students for update to authenticated
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

drop policy if exists health_select on public.student_health_info;
drop policy if exists health_insert on public.student_health_info;
drop policy if exists health_update on public.student_health_info;
create policy health_select on public.student_health_info for select to authenticated
  using (exists (
    select 1 from public.students s
    where s.id = student_id and private.same_vendor(s.vendor_id)
      and (private.current_role() in ('super_admin', 'vendor_admin') or s.branch_id = private.current_branch_id())
  ));
create policy health_insert on public.student_health_info for insert to authenticated
  with check (exists (
    select 1 from public.students s
    where s.id = student_id and private.same_vendor(s.vendor_id)
      and private.current_role() in ('super_admin', 'vendor_admin', 'data_entry')
      and (private.current_role() in ('super_admin', 'vendor_admin') or s.branch_id = private.current_branch_id())
  ));
create policy health_update on public.student_health_info for update to authenticated
  using (exists (
    select 1 from public.students s
    where s.id = student_id and private.same_vendor(s.vendor_id)
      and private.current_role() in ('super_admin', 'vendor_admin', 'data_entry')
      and (private.current_role() in ('super_admin', 'vendor_admin') or s.branch_id = private.current_branch_id())
  ))
  with check (exists (
    select 1 from public.students s
    where s.id = student_id and private.same_vendor(s.vendor_id)
      and private.current_role() in ('super_admin', 'vendor_admin', 'data_entry')
      and (private.current_role() in ('super_admin', 'vendor_admin') or s.branch_id = private.current_branch_id())
  ));

drop policy if exists fee_plans_select on public.student_fee_plans;
drop policy if exists fee_plans_insert on public.student_fee_plans;
drop policy if exists fee_plans_update on public.student_fee_plans;
create policy fee_plans_select on public.student_fee_plans for select to authenticated
  using (exists (
    select 1 from public.students s where s.id = student_id and private.same_vendor(s.vendor_id)
      and (private.current_role() in ('super_admin', 'vendor_admin') or s.branch_id = private.current_branch_id())
  ));
create policy fee_plans_insert on public.student_fee_plans for insert to authenticated
  with check (exists (
    select 1 from public.students s where s.id = student_id and private.same_vendor(s.vendor_id)
      and private.current_role() in ('super_admin', 'vendor_admin', 'data_entry')
      and (private.current_role() in ('super_admin', 'vendor_admin') or s.branch_id = private.current_branch_id())
  ));
create policy fee_plans_update on public.student_fee_plans for update to authenticated
  using (exists (
    select 1 from public.students s where s.id = student_id and private.same_vendor(s.vendor_id)
      and private.current_role() in ('super_admin', 'vendor_admin', 'data_entry')
  ))
  with check (exists (
    select 1 from public.students s where s.id = student_id and private.same_vendor(s.vendor_id)
      and private.current_role() in ('super_admin', 'vendor_admin', 'data_entry')
  ));

drop policy if exists fee_dues_select on public.fee_dues;
drop policy if exists fee_dues_insert on public.fee_dues;
drop policy if exists fee_dues_update on public.fee_dues;
create policy fee_dues_select on public.fee_dues for select to authenticated
  using (
    private.same_vendor(vendor_id)
    and (private.current_role() in ('super_admin', 'vendor_admin') or branch_id = private.current_branch_id())
  );
create policy fee_dues_insert on public.fee_dues for insert to authenticated
  with check (private.is_super_admin() or private.current_role() = 'vendor_admin');
create policy fee_dues_update on public.fee_dues for update to authenticated
  using (private.same_vendor(vendor_id))
  with check (private.same_vendor(vendor_id));

drop policy if exists payments_select on public.payments;
drop policy if exists payments_insert on public.payments;
drop policy if exists payments_update on public.payments;
create policy payments_select on public.payments for select to authenticated
  using (
    private.same_vendor(vendor_id)
    and (private.current_role() in ('super_admin', 'vendor_admin') or branch_id = private.current_branch_id())
  );
create policy payments_insert on public.payments for insert to authenticated
  with check (
    private.same_vendor(vendor_id)
    and private.current_role() in ('super_admin', 'vendor_admin', 'data_entry')
    and (private.current_role() in ('super_admin', 'vendor_admin') or branch_id = private.current_branch_id())
    and status = 'pending_accountant'
    and recorded_by = auth.uid()
  );
create policy payments_update on public.payments for update to authenticated
  using (
    private.same_vendor(vendor_id)
    and (
      (private.current_role() = 'accountant' and status = 'pending_accountant' and branch_id = private.current_branch_id())
      or (private.current_role() = 'principal' and status = 'pending_principal' and branch_id = private.current_branch_id())
      or private.current_role() in ('super_admin', 'vendor_admin')
    )
  )
  with check (private.same_vendor(vendor_id));

drop policy if exists donations_select on public.donations;
drop policy if exists donations_insert on public.donations;
drop policy if exists donations_update on public.donations;
create policy donations_select on public.donations for select to authenticated
  using (
    private.same_vendor(vendor_id)
    and (private.current_role() in ('super_admin', 'vendor_admin') or branch_id = private.current_branch_id())
  );
create policy donations_insert on public.donations for insert to authenticated
  with check (
    private.same_vendor(vendor_id)
    and private.current_role() in ('super_admin', 'vendor_admin', 'data_entry')
    and (private.current_role() in ('super_admin', 'vendor_admin') or branch_id = private.current_branch_id())
    and status = 'pending_accountant'
    and received_by = auth.uid()
  );
create policy donations_update on public.donations for update to authenticated
  using (
    private.same_vendor(vendor_id)
    and (
      (private.current_role() = 'accountant' and status = 'pending_accountant' and branch_id = private.current_branch_id())
      or (private.current_role() = 'principal' and status = 'pending_principal' and branch_id = private.current_branch_id())
      or private.current_role() in ('super_admin', 'vendor_admin')
    )
  )
  with check (private.same_vendor(vendor_id));

drop policy if exists accounts_select on public.accounts;
drop policy if exists accounts_insert on public.accounts;
drop policy if exists accounts_update on public.accounts;
create policy accounts_select on public.accounts for select to authenticated
  using (private.same_vendor(vendor_id));
create policy accounts_insert on public.accounts for insert to authenticated
  with check (private.is_super_admin() or private.current_role() = 'vendor_admin');
create policy accounts_update on public.accounts for update to authenticated
  using (private.is_super_admin() or private.current_role() = 'vendor_admin')
  with check (private.is_super_admin() or private.current_role() = 'vendor_admin');

drop policy if exists ledger_select on public.ledger_entries;
create policy ledger_select on public.ledger_entries for select to authenticated
  using (
    private.same_vendor(vendor_id)
    and (private.current_role() in ('super_admin', 'vendor_admin', 'accountant', 'principal')
      or branch_id = private.current_branch_id())
  );

drop policy if exists whatsapp_select on public.whatsapp_messages;
drop policy if exists whatsapp_insert on public.whatsapp_messages;
drop policy if exists whatsapp_update on public.whatsapp_messages;
create policy whatsapp_select on public.whatsapp_messages for select to authenticated
  using (private.is_super_admin() or private.same_vendor(vendor_id));
create policy whatsapp_insert on public.whatsapp_messages for insert to authenticated
  with check (private.is_super_admin() or private.same_vendor(vendor_id));
create policy whatsapp_update on public.whatsapp_messages for update to authenticated
  using (private.is_super_admin() or private.same_vendor(vendor_id))
  with check (private.is_super_admin() or private.same_vendor(vendor_id));

drop policy if exists audit_select on public.audit_logs;
drop policy if exists audit_insert on public.audit_logs;
create policy audit_select on public.audit_logs for select to authenticated
  using (private.is_super_admin() or private.same_vendor(vendor_id));
create policy audit_insert on public.audit_logs for insert to authenticated
  with check (true);

revoke all on table public.vendors from anon, public;
revoke all on table public.branches from anon, public;
revoke all on table public.app_users from anon, public;
revoke all on table public.students from anon, public;
revoke all on table public.student_health_info from anon, public;
revoke all on table public.student_fee_plans from anon, public;
revoke all on table public.fee_dues from anon, public;
revoke all on table public.payments from anon, public;
revoke all on table public.donations from anon, public;
revoke all on table public.accounts from anon, public;
revoke all on table public.ledger_entries from anon, public;
revoke all on table public.whatsapp_messages from anon, public;
revoke all on table public.audit_logs from anon, public;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
