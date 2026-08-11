-- Optional notes on donations (donor remark / purpose).
alter table public.donations
  add column if not exists notes text;

comment on column public.donations.notes is 'Optional donor remark or purpose';
