-- Academic sections (Hifz | Sariya 1–7) + library (kutub / qithab) loans

do $$ begin
  create type public.academic_section as enum ('hifz', 'sariya');
exception when duplicate_object then null;
end $$;

alter table public.classes
  add column if not exists section public.academic_section,
  add column if not exists grade smallint;

alter table public.classes drop constraint if exists classes_grade_range;
alter table public.classes
  add constraint classes_grade_range
  check (grade is null or (grade >= 1 and grade <= 7));

alter table public.classes drop constraint if exists classes_section_grade_check;
alter table public.classes
  add constraint classes_section_grade_check
  check (
    section is null
    or (section = 'hifz' and grade is null)
    or (section = 'sariya' and grade between 1 and 7)
  );

-- Normalize legacy Excel names → Hifz / Sariya N
update public.classes
set
  section = 'hifz',
  grade = null,
  name = 'Hifz'
where lower(trim(name)) = 'hifz';

update public.classes
set
  section = 'sariya',
  grade = (regexp_match(trim(name), '(?i)^grade\s*([1-7])$'))[1]::smallint,
  name = 'Sariya ' || (regexp_match(trim(name), '(?i)^grade\s*([1-7])$'))[1]
where trim(name) ~* '^grade\s*[1-7]$';

update public.classes
set
  section = 'sariya',
  grade = (regexp_match(trim(name), '(?i)^sariya\s*([1-7])$'))[1]::smallint,
  name = 'Sariya ' || (regexp_match(trim(name), '(?i)^sariya\s*([1-7])$'))[1]
where trim(name) ~* '^sariya\s*[1-7]$';

-- Ensure Hifz + Sariya 1–7 exist for every branch that already has classes
insert into public.classes (vendor_id, branch_id, name, section, grade, is_active)
select v.vendor_id, v.branch_id, 'Hifz', 'hifz'::public.academic_section, null, true
from (select distinct vendor_id, branch_id from public.classes) v
where not exists (
  select 1 from public.classes c
  where c.branch_id = v.branch_id and c.section = 'hifz'
);

insert into public.classes (vendor_id, branch_id, name, section, grade, is_active)
select v.vendor_id, v.branch_id, 'Sariya ' || g.n, 'sariya'::public.academic_section, g.n, true
from (select distinct vendor_id, branch_id from public.classes) v
cross join generate_series(1, 7) as g(n)
where not exists (
  select 1 from public.classes c
  where c.branch_id = v.branch_id and c.section = 'sariya' and c.grade = g.n
);

-- Staff-managed book types (custom categories)
create table if not exists public.library_book_types (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  name text not null,
  created_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (vendor_id, branch_id, name)
);

-- Library books (kutub / qithab)
create table if not exists public.library_books (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  title text not null,
  qitab_id text not null,
  author text,
  type_id uuid references public.library_book_types (id) on delete set null,
  copies_total integer not null default 1 check (copies_total >= 1),
  notes text,
  is_active boolean not null default true,
  created_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (vendor_id, qitab_id)
);

-- If an earlier draft table existed without qitab_id, add it safely.
alter table public.library_books
  add column if not exists qitab_id text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'library_books' and column_name = 'qitab_id'
  ) then
    update public.library_books
    set qitab_id = 'Q-' || substr(id::text, 1, 8)
    where qitab_id is null or btrim(qitab_id) = '';
    alter table public.library_books alter column qitab_id set not null;
  end if;
exception when others then null;
end $$;

do $$ begin
  alter table public.library_books
    add constraint library_books_vendor_qitab_unique unique (vendor_id, qitab_id);
exception when duplicate_object then null;
end $$;

alter table public.library_books
  add column if not exists type_id uuid references public.library_book_types (id) on delete set null;

create table if not exists public.library_loans (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  book_id uuid not null references public.library_books (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete restrict,
  borrowed_at timestamptz not null default now(),
  due_at timestamptz,
  returned_at timestamptz,
  borrowed_by uuid references public.app_users (id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_classes_section_grade
  on public.classes (branch_id, section, grade);
create index if not exists idx_library_books_branch
  on public.library_books (vendor_id, branch_id);
create index if not exists idx_library_books_qitab
  on public.library_books (vendor_id, qitab_id);
create index if not exists idx_library_books_type
  on public.library_books (type_id);
create index if not exists idx_library_book_types_branch
  on public.library_book_types (vendor_id, branch_id);
create index if not exists idx_library_loans_active
  on public.library_loans (book_id) where returned_at is null;
create index if not exists idx_library_loans_student
  on public.library_loans (student_id, borrowed_at desc);

alter table public.library_book_types enable row level security;
alter table public.library_books enable row level security;
alter table public.library_loans enable row level security;

drop policy if exists library_book_types_select on public.library_book_types;
drop policy if exists library_book_types_write on public.library_book_types;
create policy library_book_types_select on public.library_book_types for select to authenticated
  using (
    private.same_vendor(vendor_id)
    and (
      private.is_super_admin()
      or private.current_role() = 'vendor_admin'
      or branch_id = private.current_branch_id()
    )
  );
create policy library_book_types_write on public.library_book_types for all to authenticated
  using (
    private.can_manage_branch(vendor_id, branch_id)
    and private.current_role() in ('super_admin', 'vendor_admin', 'principal', 'data_entry')
  )
  with check (
    private.can_manage_branch(vendor_id, branch_id)
    and private.current_role() in ('super_admin', 'vendor_admin', 'principal', 'data_entry')
  );

drop policy if exists library_books_select on public.library_books;
drop policy if exists library_books_write on public.library_books;
create policy library_books_select on public.library_books for select to authenticated
  using (
    private.same_vendor(vendor_id)
    and (
      private.is_super_admin()
      or private.current_role() = 'vendor_admin'
      or branch_id = private.current_branch_id()
    )
  );
create policy library_books_write on public.library_books for all to authenticated
  using (
    private.can_manage_branch(vendor_id, branch_id)
    and private.current_role() in ('super_admin', 'vendor_admin', 'principal', 'data_entry')
  )
  with check (
    private.can_manage_branch(vendor_id, branch_id)
    and private.current_role() in ('super_admin', 'vendor_admin', 'principal', 'data_entry')
  );

drop policy if exists library_loans_select on public.library_loans;
drop policy if exists library_loans_write on public.library_loans;
create policy library_loans_select on public.library_loans for select to authenticated
  using (
    private.same_vendor(vendor_id)
    and (
      private.is_super_admin()
      or private.current_role() = 'vendor_admin'
      or branch_id = private.current_branch_id()
    )
  );
create policy library_loans_write on public.library_loans for all to authenticated
  using (
    private.can_manage_branch(vendor_id, branch_id)
    and private.current_role() in ('super_admin', 'vendor_admin', 'principal', 'data_entry')
  )
  with check (
    private.can_manage_branch(vendor_id, branch_id)
    and private.current_role() in ('super_admin', 'vendor_admin', 'principal', 'data_entry')
  );

revoke all on table public.library_book_types from anon, public;
revoke all on table public.library_books from anon, public;
revoke all on table public.library_loans from anon, public;
grant select, insert, update, delete on public.library_book_types to authenticated;
grant select, insert, update, delete on public.library_books to authenticated;
grant select, insert, update, delete on public.library_loans to authenticated;
