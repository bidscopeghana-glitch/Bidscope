begin;

create table if not exists public.tender_call_sessions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.tender_conversations(id) on delete cascade,
  channel_name text not null unique check (length(channel_name) between 8 and 63),
  started_by_user_id uuid not null references auth.users(id) on delete restrict,
  started_by_organization_id uuid not null references public.organizations(id) on delete restrict,
  ended_by_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'active' check (status in ('active','ended','expired')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at > started_at),
  check ((status='active' and ended_at is null) or status<>'active')
);

create unique index if not exists tender_call_sessions_one_active_idx
  on public.tender_call_sessions(conversation_id) where status='active';
create index if not exists tender_call_sessions_conversation_idx
  on public.tender_call_sessions(conversation_id,started_at desc);

alter table public.tender_call_sessions enable row level security;

drop policy if exists tender_call_sessions_participant_read on public.tender_call_sessions;
create policy tender_call_sessions_participant_read on public.tender_call_sessions for select to authenticated
  using((select private.can_access_tender_conversation(conversation_id)));

revoke all on public.tender_call_sessions from anon,authenticated;
grant select on public.tender_call_sessions to authenticated;
grant all on public.tender_call_sessions to service_role;

commit;
