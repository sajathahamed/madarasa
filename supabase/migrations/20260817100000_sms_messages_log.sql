-- SMS send log: message body, sender, receiver, for admin audit

create table if not exists public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references public.vendors (id) on delete set null,
  branch_id uuid references public.branches (id) on delete set null,
  sender_id uuid references public.app_users (id) on delete set null,
  sender_name text,
  recipient_phone text not null,
  recipient_name text,
  student_id uuid references public.students (id) on delete set null,
  staff_id uuid references public.staff_members (id) on delete set null,
  message_body text not null,
  purpose text not null default 'message',
  status text not null default 'sent'
    check (status in ('sent', 'failed', 'queued')),
  provider_response jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists sms_messages_vendor_created_idx
  on public.sms_messages (vendor_id, created_at desc);

create index if not exists sms_messages_branch_created_idx
  on public.sms_messages (branch_id, created_at desc);

create index if not exists sms_messages_recipient_phone_idx
  on public.sms_messages (vendor_id, recipient_phone, created_at desc);

create index if not exists sms_messages_sender_idx
  on public.sms_messages (vendor_id, sender_id, created_at desc);

comment on table public.sms_messages is
  'Log of every Dialog SMS send: who sent, who received, message body, status';

alter table public.sms_messages enable row level security;

drop policy if exists sms_messages_select on public.sms_messages;
drop policy if exists sms_messages_insert on public.sms_messages;

-- Admin (and super_admin) can read; data_entry cannot browse the full log
create policy sms_messages_select on public.sms_messages for select to authenticated
  using (
    private.same_vendor(vendor_id)
    and (
      private.is_super_admin()
      or private.current_role() = 'vendor_admin'
    )
  );

-- Inserts usually go via service role; allow authenticated senders to insert their own rows
create policy sms_messages_insert on public.sms_messages for insert to authenticated
  with check (
    private.same_vendor(vendor_id)
    and private.current_role() in (
      'super_admin',
      'vendor_admin',
      'data_entry',
      'accountant',
      'principal'
    )
    and (sender_id is null or sender_id = auth.uid())
  );
