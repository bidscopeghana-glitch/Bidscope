create extension if not exists pgcrypto;

create table if not exists public.meeting_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  enabled boolean not null default true,
  max_duration_minutes integer not null default 120 check (max_duration_minutes between 15 and 480),
  max_participants integer not null default 20 check (max_participants between 2 and 200),
  monthly_participant_minutes integer not null default 10000 check (monthly_participant_minutes between 0 and 1000000),
  recording_allowed boolean not null default false,
  transcription_allowed boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  organizer_user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('daily','google_meet')),
  meeting_type text not null default 'team' check (meeting_type in ('team','tender','partner')),
  title text not null check (length(title) between 3 and 200),
  agenda text not null default '',
  timezone text not null default 'Africa/Accra',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','live','completed','cancelled','provider_failed')),
  related_opportunity_id uuid references public.procurement_opportunities(id) on delete set null,
  related_partner_organization_id uuid references public.organizations(id) on delete set null,
  recurrence_rule text,
  reminder_minutes integer not null default 30 check (reminder_minutes between 0 and 10080),
  waiting_room_enabled boolean not null default true,
  recording_enabled boolean not null default false,
  transcription_enabled boolean not null default false,
  provider_room_id text,
  provider_room_name text,
  provider_join_url text,
  provider_event_id text,
  provider_status text not null default 'pending',
  provider_metadata jsonb not null default '{}'::jsonb,
  provider_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists meetings_organization_start_idx on public.meetings(organization_id, starts_at desc);
create index if not exists meetings_provider_room_idx on public.meetings(provider_room_name) where provider_room_name is not null;

create table if not exists public.meeting_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  guest_email text,
  guest_name text,
  role text not null default 'attendee' check (role in ('organizer','host','attendee')),
  response_status text not null default 'invited' check (response_status in ('invited','accepted','tentative','declined','joined','no_show')),
  guest_token_hash text unique,
  guest_token_expires_at timestamptz,
  joined_at timestamptz,
  left_at timestamptz,
  attendance_seconds integer not null default 0 check (attendance_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or guest_email is not null)
);

create unique index if not exists meeting_participants_user_idx on public.meeting_participants(meeting_id,user_id) where user_id is not null;
create unique index if not exists meeting_participants_guest_idx on public.meeting_participants(meeting_id,lower(guest_email)) where guest_email is not null;

create table if not exists public.meeting_notes (
  meeting_id uuid primary key references public.meetings(id) on delete cascade,
  content text not null default '',
  updated_by uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);

create table if not exists public.meeting_action_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  related_opportunity_id uuid references public.procurement_opportunities(id) on delete set null,
  task text not null check (length(task) between 2 and 500),
  owner_user_id uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','in_progress','completed','cancelled')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meeting_usage_events (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('daily','google_meet')),
  participant_count integer not null default 0,
  duration_seconds integer not null default 0,
  participant_minutes integer not null default 0,
  recording_minutes integer not null default 0,
  transcription_minutes integer not null default 0,
  occurred_at timestamptz not null default now()
);

create table if not exists public.meeting_provider_events (
  provider text not null,
  provider_event_id text not null,
  meeting_id uuid references public.meetings(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  primary key(provider,provider_event_id)
);

create table if not exists public.meeting_oauth_connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider = 'google'),
  encrypted_refresh_token text not null,
  encrypted_access_token text,
  access_token_expires_at timestamptz,
  scopes text[] not null default '{}',
  provider_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id,provider)
);

create table if not exists public.meeting_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  return_path text not null default '/customer/meetings',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.meeting_settings enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_participants enable row level security;
alter table public.meeting_notes enable row level security;
alter table public.meeting_action_items enable row level security;
alter table public.meeting_usage_events enable row level security;
alter table public.meeting_provider_events enable row level security;
alter table public.meeting_oauth_connections enable row level security;
alter table public.meeting_oauth_states enable row level security;

create or replace function public.is_meeting_participant(p_meeting_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.meetings m where m.id=p_meeting_id and (m.organizer_user_id=auth.uid() or exists(select 1 from public.meeting_participants p where p.meeting_id=m.id and p.user_id=auth.uid())));
$$;

create policy meeting_settings_member_read on public.meeting_settings for select to authenticated using (public.is_organization_member(organization_id));
create policy meeting_settings_admin_write on public.meeting_settings for all to authenticated using (public.is_organization_admin(organization_id)) with check (public.is_organization_admin(organization_id));
create policy meetings_participant_read on public.meetings for select to authenticated using (public.is_organization_member(organization_id) and public.is_meeting_participant(id));
create policy meeting_participants_member_read on public.meeting_participants for select to authenticated using (public.is_meeting_participant(meeting_id));
create policy meeting_notes_participant_read on public.meeting_notes for select to authenticated using (public.is_meeting_participant(meeting_id));
create policy meeting_actions_member_read on public.meeting_action_items for select to authenticated using (public.is_organization_member(organization_id));
create policy meeting_usage_admin_read on public.meeting_usage_events for select to authenticated using (public.is_organization_admin(organization_id));
create policy meeting_oauth_owner_read on public.meeting_oauth_connections for select to authenticated using (user_id=auth.uid());

revoke all on public.meetings, public.meeting_participants, public.meeting_notes, public.meeting_action_items, public.meeting_usage_events, public.meeting_provider_events, public.meeting_oauth_connections, public.meeting_oauth_states from anon, authenticated;
grant select (id,organization_id,organizer_user_id,provider,meeting_type,title,agenda,timezone,starts_at,ends_at,status,related_opportunity_id,related_partner_organization_id,recurrence_rule,reminder_minutes,waiting_room_enabled,recording_enabled,transcription_enabled,provider_status,created_at,updated_at) on public.meetings to authenticated;
grant select on public.meeting_participants, public.meeting_notes, public.meeting_action_items to authenticated;
grant select on public.meeting_settings, public.meeting_usage_events to authenticated;
grant all on public.meeting_settings, public.meetings, public.meeting_participants, public.meeting_notes, public.meeting_action_items, public.meeting_usage_events, public.meeting_provider_events, public.meeting_oauth_connections, public.meeting_oauth_states to service_role;
grant execute on function public.is_meeting_participant(uuid) to authenticated, service_role;

drop trigger if exists meetings_set_updated_at on public.meetings;
create trigger meetings_set_updated_at before update on public.meetings for each row execute function public.set_updated_at();
drop trigger if exists meeting_participants_set_updated_at on public.meeting_participants;
create trigger meeting_participants_set_updated_at before update on public.meeting_participants for each row execute function public.set_updated_at();
drop trigger if exists meeting_actions_set_updated_at on public.meeting_action_items;
create trigger meeting_actions_set_updated_at before update on public.meeting_action_items for each row execute function public.set_updated_at();
drop trigger if exists meeting_settings_set_updated_at on public.meeting_settings;
create trigger meeting_settings_set_updated_at before update on public.meeting_settings for each row execute function public.set_updated_at();
drop trigger if exists meeting_oauth_connections_set_updated_at on public.meeting_oauth_connections;
create trigger meeting_oauth_connections_set_updated_at before update on public.meeting_oauth_connections for each row execute function public.set_updated_at();
