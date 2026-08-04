-- Extend WhatsApp message types (text check constraint, not enum)
alter table public.whatsapp_messages drop constraint if exists whatsapp_messages_message_type_check;
alter table public.whatsapp_messages
  add constraint whatsapp_messages_message_type_check
  check (message_type in (
    'credentials',
    'payment_confirmation',
    'payment_reminder',
    'bulk_reminder',
    'absence_alert',
    'progress_note'
  ));

do $$ begin
  create type public.attendance_status as enum ('present', 'absent', 'late');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.islamic_stream as enum ('qaida', 'nazirah', 'hifz');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.hifz_component as enum ('sabaq', 'sabqi', 'manzil', 'juz');
exception when duplicate_object then null;
end $$;

create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  unique (vendor_id, name)
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  academic_year_id uuid references public.academic_years (id) on delete set null,
  name text not null,
  teacher_id uuid references public.app_users (id) on delete set null,
  schedule_note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (branch_id, name)
);

create table if not exists public.class_enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  enrolled_at date not null default current_date,
  left_at date,
  is_active boolean not null default true,
  unique (class_id, student_id)
);

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  session_date date not null,
  marked_by uuid references public.app_users (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  unique (class_id, session_date)
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  status public.attendance_status not null default 'present',
  note text,
  unique (session_id, student_id)
);

create table if not exists public.islamic_progress_logs (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  class_id uuid references public.classes (id) on delete set null,
  stream public.islamic_stream not null,
  hifz_component public.hifz_component,
  lesson_label text not null,
  pages_or_ayah text,
  quality_note text,
  logged_by uuid references public.app_users (id) on delete set null,
  logged_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.parent_access_tokens (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  token_hash text not null unique,
  label text,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists idx_classes_vendor_branch on public.classes (vendor_id, branch_id);
create index if not exists idx_enrollments_student on public.class_enrollments (student_id);
create index if not exists idx_attendance_sessions_date on public.attendance_sessions (session_date);
create index if not exists idx_attendance_records_student on public.attendance_records (student_id);
create index if not exists idx_progress_student on public.islamic_progress_logs (student_id, logged_on desc);
create index if not exists idx_parent_tokens_student on public.parent_access_tokens (student_id);

-- RLS
alter table public.academic_years enable row level security;
alter table public.classes enable row level security;
alter table public.class_enrollments enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.islamic_progress_logs enable row level security;
alter table public.parent_access_tokens enable row level security;

create or replace function private.can_manage_branch(p_vendor_id uuid, p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_super_admin()
    or (
      private.same_vendor(p_vendor_id)
      and (
        private.current_role() = 'vendor_admin'
        or private.current_branch_id() = p_branch_id
      )
    );
$$;

grant execute on function private.can_manage_branch(uuid, uuid) to authenticated;

-- academic_years
drop policy if exists academic_years_select on public.academic_years;
drop policy if exists academic_years_write on public.academic_years;
create policy academic_years_select on public.academic_years for select to authenticated
  using (private.same_vendor(vendor_id));
create policy academic_years_write on public.academic_years for all to authenticated
  using (
    private.is_super_admin()
    or (private.current_role() = 'vendor_admin' and vendor_id = private.current_vendor_id())
  )
  with check (
    private.is_super_admin()
    or (private.current_role() = 'vendor_admin' and vendor_id = private.current_vendor_id())
  );

-- classes
drop policy if exists classes_select on public.classes;
drop policy if exists classes_write on public.classes;
create policy classes_select on public.classes for select to authenticated
  using (
    private.same_vendor(vendor_id)
    and (
      private.is_super_admin()
      or private.current_role() = 'vendor_admin'
      or branch_id = private.current_branch_id()
    )
  );
create policy classes_write on public.classes for all to authenticated
  using (private.can_manage_branch(vendor_id, branch_id)
    and private.current_role() in ('super_admin', 'vendor_admin', 'principal', 'data_entry'))
  with check (private.can_manage_branch(vendor_id, branch_id)
    and private.current_role() in ('super_admin', 'vendor_admin', 'principal', 'data_entry'));

-- enrollments
drop policy if exists enrollments_select on public.class_enrollments;
drop policy if exists enrollments_write on public.class_enrollments;
create policy enrollments_select on public.class_enrollments for select to authenticated
  using (
    exists (
      select 1 from public.classes c
      where c.id = class_id and private.same_vendor(c.vendor_id)
        and (
          private.is_super_admin()
          or private.current_role() = 'vendor_admin'
          or c.branch_id = private.current_branch_id()
        )
    )
  );
create policy enrollments_write on public.class_enrollments for all to authenticated
  using (
    exists (
      select 1 from public.classes c
      where c.id = class_id
        and private.can_manage_branch(c.vendor_id, c.branch_id)
        and private.current_role() in ('super_admin', 'vendor_admin', 'principal', 'data_entry')
    )
  )
  with check (
    exists (
      select 1 from public.classes c
      where c.id = class_id
        and private.can_manage_branch(c.vendor_id, c.branch_id)
        and private.current_role() in ('super_admin', 'vendor_admin', 'principal', 'data_entry')
    )
  );

-- attendance sessions
drop policy if exists attendance_sessions_select on public.attendance_sessions;
drop policy if exists attendance_sessions_write on public.attendance_sessions;
create policy attendance_sessions_select on public.attendance_sessions for select to authenticated
  using (
    private.same_vendor(vendor_id)
    and (
      private.is_super_admin()
      or private.current_role() = 'vendor_admin'
      or branch_id = private.current_branch_id()
    )
  );
create policy attendance_sessions_write on public.attendance_sessions for all to authenticated
  using (
    private.can_manage_branch(vendor_id, branch_id)
    and private.current_role() in ('super_admin', 'vendor_admin', 'principal', 'data_entry', 'accountant')
  )
  with check (
    private.can_manage_branch(vendor_id, branch_id)
    and private.current_role() in ('super_admin', 'vendor_admin', 'principal', 'data_entry', 'accountant')
  );

-- attendance records
drop policy if exists attendance_records_select on public.attendance_records;
drop policy if exists attendance_records_write on public.attendance_records;
create policy attendance_records_select on public.attendance_records for select to authenticated
  using (
    exists (
      select 1 from public.attendance_sessions s
      where s.id = session_id and private.same_vendor(s.vendor_id)
        and (
          private.is_super_admin()
          or private.current_role() = 'vendor_admin'
          or s.branch_id = private.current_branch_id()
        )
    )
  );
create policy attendance_records_write on public.attendance_records for all to authenticated
  using (
    exists (
      select 1 from public.attendance_sessions s
      where s.id = session_id
        and private.can_manage_branch(s.vendor_id, s.branch_id)
        and private.current_role() in ('super_admin', 'vendor_admin', 'principal', 'data_entry', 'accountant')
    )
  )
  with check (
    exists (
      select 1 from public.attendance_sessions s
      where s.id = session_id
        and private.can_manage_branch(s.vendor_id, s.branch_id)
        and private.current_role() in ('super_admin', 'vendor_admin', 'principal', 'data_entry', 'accountant')
    )
  );

-- islamic progress
drop policy if exists progress_select on public.islamic_progress_logs;
drop policy if exists progress_write on public.islamic_progress_logs;
create policy progress_select on public.islamic_progress_logs for select to authenticated
  using (
    private.same_vendor(vendor_id)
    and (
      private.is_super_admin()
      or private.current_role() = 'vendor_admin'
      or branch_id = private.current_branch_id()
    )
  );
create policy progress_write on public.islamic_progress_logs for all to authenticated
  using (
    private.can_manage_branch(vendor_id, branch_id)
    and private.current_role() in ('super_admin', 'vendor_admin', 'principal', 'data_entry')
  )
  with check (
    private.can_manage_branch(vendor_id, branch_id)
    and private.current_role() in ('super_admin', 'vendor_admin', 'principal', 'data_entry')
  );

-- parent tokens (staff manage; anon never)
drop policy if exists parent_tokens_select on public.parent_access_tokens;
drop policy if exists parent_tokens_write on public.parent_access_tokens;
create policy parent_tokens_select on public.parent_access_tokens for select to authenticated
  using (private.same_vendor(vendor_id));
create policy parent_tokens_write on public.parent_access_tokens for all to authenticated
  using (
    private.is_super_admin()
    or (private.current_role() in ('vendor_admin', 'principal', 'data_entry')
        and vendor_id = private.current_vendor_id())
  )
  with check (
    private.is_super_admin()
    or (private.current_role() in ('vendor_admin', 'principal', 'data_entry')
        and vendor_id = private.current_vendor_id())
  );

revoke all on table public.academic_years from anon, public;
revoke all on table public.classes from anon, public;
revoke all on table public.class_enrollments from anon, public;
revoke all on table public.attendance_sessions from anon, public;
revoke all on table public.attendance_records from anon, public;
revoke all on table public.islamic_progress_logs from anon, public;
revoke all on table public.parent_access_tokens from anon, public;

grant select, insert, update, delete on public.academic_years to authenticated;
grant select, insert, update, delete on public.classes to authenticated;
grant select, insert, update, delete on public.class_enrollments to authenticated;
grant select, insert, update, delete on public.attendance_sessions to authenticated;
grant select, insert, update, delete on public.attendance_records to authenticated;
grant select, insert, update, delete on public.islamic_progress_logs to authenticated;
grant select, insert, update, delete on public.parent_access_tokens to authenticated;
