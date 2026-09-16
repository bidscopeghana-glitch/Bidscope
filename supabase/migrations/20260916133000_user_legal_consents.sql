create table if not exists public.user_legal_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type in ('terms', 'privacy', 'cookies')),
  document_version text not null,
  accepted_at timestamptz not null default now(),
  acceptance_method text not null check (acceptance_method in ('password', 'google')),
  created_at timestamptz not null default now(),
  unique (user_id, document_type, document_version)
);

create index if not exists user_legal_consents_user_id_idx on public.user_legal_consents(user_id);
alter table public.user_legal_consents enable row level security;

drop policy if exists "legal_consents_read_self" on public.user_legal_consents;
create policy "legal_consents_read_self" on public.user_legal_consents
  for select using (user_id = auth.uid());

revoke all on public.user_legal_consents from anon;
grant select on public.user_legal_consents to authenticated;

