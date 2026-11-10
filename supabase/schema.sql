-- Lead storage for the consultation form.
-- Run this file in the Supabase SQL Editor before configuring the API.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'lead_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.lead_status as enum ('new', 'contacted', 'quoted', 'won', 'lost');
  end if;
end
$$;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  phone text not null,
  email text,
  company text,
  service text not null,
  budget text,
  timeline text,
  message text,
  marketing_consent boolean not null default false,
  language text not null check (language in ('vi', 'en')),
  source_page text,
  status public.lead_status not null default 'new',
  internal_note text,
  contacted_at timestamptz,
  email_sent boolean not null default false
);

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.set_leads_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
before update on public.leads
for each row
execute function public.set_leads_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admins
    where user_id = auth.uid()
  );
$$;

revoke all on table public.leads from anon, authenticated;
revoke all on table public.admins from anon, authenticated;

grant select on table public.leads to authenticated;
grant update (status, internal_note, contacted_at) on table public.leads to authenticated;

alter table public.leads enable row level security;
alter table public.admins enable row level security;

drop policy if exists "admins can read leads" on public.leads;
create policy "admins can read leads"
on public.leads
for select
to authenticated
using (public.is_admin());

drop policy if exists "admins can update lead fields" on public.leads;
create policy "admins can update lead fields"
on public.leads
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create index if not exists leads_created_at_desc_idx
  on public.leads (created_at desc);

create index if not exists leads_status_idx
  on public.leads (status);

-- To add an administrator, first create the user in Supabase Auth, then run:
-- insert into public.admins (user_id) values ('AUTH-USER-UUID-HERE');
