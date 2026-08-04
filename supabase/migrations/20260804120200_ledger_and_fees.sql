-- Ledger posting triggers + monthly fee generation
create or replace function private.create_default_accounts(p_vendor_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.accounts (vendor_id, name, type, opening_balance, current_balance)
  values
    (p_vendor_id, 'Cash in Hand', 'asset', 0, 0),
    (p_vendor_id, 'Bank Account', 'asset', 0, 0),
    (p_vendor_id, 'Fee Income', 'income', 0, 0),
    (p_vendor_id, 'Donation Income', 'income', 0, 0)
  on conflict (vendor_id, name) do nothing;
end;
$$;

create or replace function private.trg_vendor_default_accounts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.create_default_accounts(new.id);
  return new;
end;
$$;

drop trigger if exists vendors_after_insert_default_accounts on public.vendors;
create trigger vendors_after_insert_default_accounts
after insert on public.vendors
for each row execute function private.trg_vendor_default_accounts();

create or replace function private.write_audit(
  p_vendor_id uuid,
  p_action text,
  p_table text,
  p_record_id uuid,
  p_old jsonb,
  p_new jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (vendor_id, user_id, action, table_name, record_id, old_data, new_data)
  values (p_vendor_id, auth.uid(), p_action, p_table, p_record_id, p_old, p_new);
end;
$$;

create or replace function private.post_balanced_entry(
  p_vendor_id uuid,
  p_branch_id uuid,
  p_source_table text,
  p_source_id uuid,
  p_debit_account_id uuid,
  p_credit_account_id uuid,
  p_amount numeric,
  p_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group uuid := gen_random_uuid();
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Ledger amount must be positive';
  end if;
  if p_debit_account_id is null or p_credit_account_id is null then
    raise exception 'Debit and credit accounts are required';
  end if;

  insert into public.ledger_entries (
    vendor_id, branch_id, txn_group_id, source_table, source_id,
    account_id, entry_type, amount, created_by
  ) values
    (p_vendor_id, p_branch_id, v_group, p_source_table, p_source_id, p_debit_account_id, 'debit', p_amount, p_created_by),
    (p_vendor_id, p_branch_id, v_group, p_source_table, p_source_id, p_credit_account_id, 'credit', p_amount, p_created_by);

  update public.accounts
  set current_balance = current_balance + p_amount
  where id = p_debit_account_id;

  update public.accounts
  set current_balance = current_balance + p_amount
  where id = p_credit_account_id;

  return v_group;
end;
$$;

create or replace function private.resolve_asset_account(p_vendor_id uuid, p_is_cash boolean)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.accounts
  where vendor_id = p_vendor_id
    and name = case when p_is_cash then 'Cash in Hand' else 'Bank Account' end
  limit 1;
$$;

create or replace function private.resolve_income_account(p_vendor_id uuid, p_name text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.accounts
  where vendor_id = p_vendor_id and name = p_name
  limit 1;
$$;

create or replace function private.fn_post_payment_to_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_debit uuid;
  v_credit uuid;
  v_is_cash boolean;
  v_due public.fee_dues%rowtype;
  v_new_paid numeric(12,2);
begin
  if tg_op = 'UPDATE' and new.status = 'approved' and old.status is distinct from 'approved' then
    v_is_cash := (new.method = 'cash');
    v_debit := private.resolve_asset_account(new.vendor_id, v_is_cash);
    v_credit := private.resolve_income_account(new.vendor_id, 'Fee Income');

    perform private.post_balanced_entry(
      new.vendor_id, new.branch_id, 'payments', new.id,
      v_debit, v_credit, new.amount, new.principal_id
    );

    if new.fee_due_id is not null then
      select * into v_due from public.fee_dues where id = new.fee_due_id for update;
      if found then
        v_new_paid := coalesce(v_due.amount_paid, 0) + new.amount;
        update public.fee_dues
        set amount_paid = v_new_paid,
            status = case
              when v_new_paid >= total_due then 'paid'
              when v_new_paid > 0 then 'partial'
              else 'unpaid'
            end
        where id = v_due.id;
      end if;
    end if;

    perform private.write_audit(
      new.vendor_id,
      'payment_approved_posted',
      'payments',
      new.id,
      to_jsonb(old),
      to_jsonb(new)
    );
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    perform private.write_audit(
      new.vendor_id,
      'payment_status_' || new.status::text,
      'payments',
      new.id,
      jsonb_build_object('status', old.status, 'remarks', old.accountant_remarks, 'principal_remarks', old.principal_remarks),
      jsonb_build_object('status', new.status, 'remarks', new.accountant_remarks, 'principal_remarks', new.principal_remarks)
    );
  end if;
  return new;
end;
$$;

create or replace function private.fn_post_donation_to_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_debit uuid;
  v_credit uuid;
  v_is_cash boolean;
begin
  if tg_op = 'UPDATE' and new.status = 'approved' and old.status is distinct from 'approved' then
    v_is_cash := (new.type = 'cash');
    v_debit := private.resolve_asset_account(new.vendor_id, v_is_cash);
    v_credit := private.resolve_income_account(new.vendor_id, 'Donation Income');

    perform private.post_balanced_entry(
      new.vendor_id, new.branch_id, 'donations', new.id,
      v_debit, v_credit, new.amount, new.principal_id
    );

    perform private.write_audit(
      new.vendor_id,
      'donation_approved_posted',
      'donations',
      new.id,
      to_jsonb(old),
      to_jsonb(new)
    );
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    perform private.write_audit(
      new.vendor_id,
      'donation_status_' || new.status::text,
      'donations',
      new.id,
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists payments_after_update_post_ledger on public.payments;
create trigger payments_after_update_post_ledger
after update on public.payments
for each row
when (new.status is distinct from old.status)
execute function private.fn_post_payment_to_ledger();

drop trigger if exists donations_after_update_post_ledger on public.donations;
create trigger donations_after_update_post_ledger
after update on public.donations
for each row
when (new.status is distinct from old.status)
execute function private.fn_post_donation_to_ledger();

create or replace function private.generate_monthly_fee_dues(p_month int default null, p_year int default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month int := coalesce(p_month, extract(month from current_date)::int);
  v_year int := coalesce(p_year, extract(year from current_date)::int);
  v_prev_month int;
  v_prev_year int;
  v_count int := 0;
  r record;
  v_month_amount numeric(12,2);
  v_carried numeric(12,2);
  v_total numeric(12,2);
begin
  if v_month = 1 then
    v_prev_month := 12;
    v_prev_year := v_year - 1;
  else
    v_prev_month := v_month - 1;
    v_prev_year := v_year;
  end if;

  for r in
    select s.id as student_id, s.vendor_id, s.branch_id, fp.monthly_amount, fp.discount_percent, fp.is_free
    from public.students s
    join public.student_fee_plans fp on fp.student_id = s.id and fp.is_current = true
    where s.status = 'active' and fp.is_free = false
  loop
    if exists (
      select 1 from public.fee_dues fd
      where fd.student_id = r.student_id and fd.due_month = v_month and fd.due_year = v_year
    ) then
      continue;
    end if;

    v_month_amount := round(r.monthly_amount * (1 - coalesce(r.discount_percent, 0) / 100.0), 2);
    select greatest(coalesce(total_due, 0) - coalesce(amount_paid, 0), 0)
      into v_carried
    from public.fee_dues
    where student_id = r.student_id and due_month = v_prev_month and due_year = v_prev_year;
    v_carried := coalesce(v_carried, 0);
    v_total := v_month_amount + v_carried;

    insert into public.fee_dues (
      student_id, vendor_id, branch_id, due_month, due_year,
      month_amount, carried_forward, total_due, amount_paid, status
    ) values (
      r.student_id, r.vendor_id, r.branch_id, v_month, v_year,
      v_month_amount, v_carried, v_total, 0,
      case when v_total = 0 then 'paid' else 'unpaid' end
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.generate_monthly_fee_dues(p_month int default null, p_year int default null)
returns integer
language sql
security definer
set search_path = ''
as $$
  select private.generate_monthly_fee_dues(p_month, p_year);
$$;

revoke all on function public.generate_monthly_fee_dues(int, int) from public, anon, authenticated;
grant execute on function public.generate_monthly_fee_dues(int, int) to service_role;
grant execute on function private.generate_monthly_fee_dues(int, int) to service_role;
