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

create or replace function public.upsert_founding_member(
  p_business_name text,
  p_contact_name text,
  p_email text,
  p_phone text,
  p_sector text,
  p_consent boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.founding_members (
    business_name,
    contact_name,
    email,
    phone,
    sector,
    consent
  )
  values (
    p_business_name,
    p_contact_name,
    lower(p_email),
    p_phone,
    p_sector,
    p_consent
  )
  on conflict (email) do update
  set business_name = excluded.business_name,
      contact_name = excluded.contact_name,
      phone = excluded.phone,
      sector = excluded.sector,
      consent = excluded.consent,
      updated_at = now();
end;
$$;

revoke all on function public.upsert_founding_member(text, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.upsert_founding_member(text, text, text, text, text, boolean) to service_role;
