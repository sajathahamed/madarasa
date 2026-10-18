-- Charge every active student each month. Students without a fee plan
-- get the default 12000 plan. Fee-free plans are skipped.
-- Existing dues for the month are left unchanged.

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
  v_default numeric(12,2) := 12000;
begin
  if v_month = 1 then
    v_prev_month := 12;
    v_prev_year := v_year - 1;
  else
    v_prev_month := v_month - 1;
    v_prev_year := v_year;
  end if;

  for r in
    select
      s.id as student_id,
      s.vendor_id,
      s.branch_id,
      fp.id as plan_id,
      fp.monthly_amount,
      fp.discount_percent,
      fp.is_free
    from public.students s
    left join public.student_fee_plans fp
      on fp.student_id = s.id and fp.is_current = true
    where s.status = 'active'
  loop
    if coalesce(r.is_free, false) or exists (
      select 1 from public.student_fee_plans free_plan
      where free_plan.student_id = r.student_id
        and free_plan.is_current = true
        and free_plan.is_free = true
    ) then
      continue;
    end if;

    if exists (
      select 1 from public.fee_dues fd
      where fd.student_id = r.student_id
        and fd.due_month = v_month
        and fd.due_year = v_year
    ) then
      continue;
    end if;

    if r.plan_id is null then
      insert into public.student_fee_plans (
        student_id, monthly_amount, is_free, discount_percent, is_current, effective_from
      ) values (
        r.student_id, v_default, false, 0, true, current_date
      );
      v_month_amount := v_default;
    else
      v_month_amount := round(
        coalesce(r.monthly_amount, v_default) * (1 - coalesce(r.discount_percent, 0) / 100.0),
        2
      );
    end if;

    select greatest(coalesce(total_due, 0) - coalesce(amount_paid, 0), 0)
      into v_carried
    from public.fee_dues
    where student_id = r.student_id
      and due_month = v_prev_month
      and due_year = v_prev_year;
    v_carried := coalesce(v_carried, 0);
    v_total := v_month_amount + v_carried;

    insert into public.fee_dues (
      student_id, vendor_id, branch_id, due_month, due_year,
      month_amount, carried_forward, total_due, amount_paid, status
    ) values (
      r.student_id, r.vendor_id, r.branch_id, v_month, v_year,
      v_month_amount, v_carried, v_total, 0,
      case when v_total = 0 then 'paid' else 'unpaid' end
    )
    on conflict (student_id, due_month, due_year) do nothing;

    if found then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function private.generate_monthly_fee_dues(int, int) from public, anon, authenticated;
grant execute on function private.generate_monthly_fee_dues(int, int) to service_role;

-- Create the current month now for every active student still missing it.
select private.generate_monthly_fee_dues(null, null);
