create table if not exists public.founding_members (
  id bigint generated always as identity primary key,
  business_name text not null,
  contact_name text not null,
  email text not null unique,
  phone text not null default '',
  sector text not null,
  consent boolean not null default false,
  status text not null default 'waitlist',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.founding_members enable row level security;

revoke all on table public.founding_members from anon, authenticated;
grant select, insert, update on table public.founding_members to service_role;
grant usage, select on sequence public.founding_members_id_seq to service_role;
