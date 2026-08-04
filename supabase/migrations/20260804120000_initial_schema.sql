-- Madarasa initial schema: enums + tables
create extension if not exists "pgcrypto" with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

do $$ begin
  create type public.user_role as enum ('super_admin', 'vendor_admin', 'data_entry', 'accountant', 'principal');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.approval_status as enum ('pending_accountant', 'pending_principal', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_method as enum ('cash', 'bank_transfer', 'card', 'online');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.donation_type as enum ('cash', 'bank_transfer');
exception when duplicate_object then null;
end $$;

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  contact_phone text,
  whatsapp_number text not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  name text not null,
  address text,
  contact_phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  vendor_id uuid references public.vendors(id),
  branch_id uuid references public.branches(id),
  role public.user_role not null,
  full_name text not null,
  phone text,
  whatsapp_number text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  constraint app_users_super_admin_no_vendor check (
    (role = 'super_admin' and vendor_id is null and branch_id is null)
    or (role <> 'super_admin')
  ),
  constraint app_users_vendor_admin_no_branch check (
    (role = 'vendor_admin' and branch_id is null)
    or (role <> 'vendor_admin')
  ),
  constraint app_users_branch_roles_have_branch check (
    (role in ('data_entry', 'accountant', 'principal') and branch_id is not null and vendor_id is not null)
    or (role not in ('data_entry', 'accountant', 'principal'))
  )
);

create index if not exists app_users_vendor_id_idx on public.app_users(vendor_id);
create index if not exists app_users_branch_id_idx on public.app_users(branch_id);
create index if not exists branches_vendor_id_idx on public.branches(vendor_id);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id),
  branch_id uuid not null references public.branches(id),
  admission_no text not null,
  full_name text not null,
  dob date,
  gender text,
  guardian_name text not null,
  guardian_phone text not null,
  address text,
  photo_url text,
  admission_date date not null default current_date,
  status text not null default 'active' check (status in ('active', 'left', 'graduated')),
  created_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  unique (vendor_id, branch_id, admission_no)
);

create index if not exists students_vendor_branch_idx on public.students(vendor_id, branch_id);
create index if not exists students_status_idx on public.students(status);

create table if not exists public.student_health_info (
  student_id uuid primary key references public.students(id) on delete cascade,
  blood_group text,
  allergies text,
  medical_conditions text,
  current_medications text,
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.student_fee_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  monthly_amount numeric(12,2) not null default 0,
  is_free boolean not null default false,
  discount_percent numeric(5,2) not null default 0,
  effective_from date not null default current_date,
  is_current boolean not null default true
);

create index if not exists student_fee_plans_student_current_idx on public.student_fee_plans(student_id) where is_current;

create table if not exists public.fee_dues (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id),
  branch_id uuid not null references public.branches(id),
  due_month int not null check (due_month between 1 and 12),
  due_year int not null check (due_year >= 2000),
  month_amount numeric(12,2) not null default 0,
  carried_forward numeric(12,2) not null default 0,
  total_due numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  status text not null default 'unpaid' check (status in ('unpaid', 'partial', 'paid')),
  created_at timestamptz not null default now(),
  unique (student_id, due_month, due_year)
);

create index if not exists fee_dues_vendor_branch_status_idx on public.fee_dues(vendor_id, branch_id, status);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id),
  branch_id uuid not null references public.branches(id),
  student_id uuid not null references public.students(id),
  fee_due_id uuid references public.fee_dues(id),
  amount numeric(12,2) not null check (amount > 0),
  method public.payment_method not null,
  bank_reference text,
  recorded_by uuid not null references public.app_users(id),
  status public.approval_status not null default 'pending_accountant',
  accountant_id uuid references public.app_users(id),
  accountant_action_at timestamptz,
  accountant_remarks text,
  principal_id uuid references public.app_users(id),
  principal_action_at timestamptz,
  principal_remarks text,
  created_at timestamptz not null default now()
);

create index if not exists payments_status_idx on public.payments(vendor_id, branch_id, status);

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id),
  branch_id uuid not null references public.branches(id),
  donor_name text not null,
  donor_phone text,
  amount numeric(12,2) not null check (amount > 0),
  type public.donation_type not null,
  bank_reference text,
  received_by uuid not null references public.app_users(id),
  status public.approval_status not null default 'pending_accountant',
  accountant_id uuid references public.app_users(id),
  accountant_action_at timestamptz,
  accountant_remarks text,
  principal_id uuid references public.app_users(id),
  principal_action_at timestamptz,
  principal_remarks text,
  created_at timestamptz not null default now()
);

create index if not exists donations_status_idx on public.donations(vendor_id, branch_id, status);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id),
  branch_id uuid references public.branches(id),
  name text not null,
  type text not null check (type in ('asset', 'income', 'expense', 'liability')),
  opening_balance numeric(14,2) not null default 0,
  current_balance numeric(14,2) not null default 0,
  unique (vendor_id, name)
);

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id),
  branch_id uuid not null references public.branches(id),
  txn_group_id uuid not null,
  source_table text not null check (source_table in ('payments', 'donations', 'expenses')),
  source_id uuid not null,
  account_id uuid not null references public.accounts(id),
  entry_type text not null check (entry_type in ('debit', 'credit')),
  amount numeric(14,2) not null check (amount > 0),
  entry_date date not null default current_date,
  created_by uuid references public.app_users(id),
  created_at timestamptz not null default now()
);

create index if not exists ledger_entries_txn_group_idx on public.ledger_entries(txn_group_id);
create index if not exists ledger_entries_vendor_date_idx on public.ledger_entries(vendor_id, entry_date);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references public.vendors(id),
  student_id uuid references public.students(id),
  recipient_phone text not null,
  message_type text not null check (message_type in ('credentials', 'payment_confirmation', 'payment_reminder', 'bulk_reminder')),
  template_name text,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  provider_response jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid,
  user_id uuid references public.app_users(id),
  action text not null,
  table_name text not null,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_vendor_created_idx on public.audit_logs(vendor_id, created_at desc);
