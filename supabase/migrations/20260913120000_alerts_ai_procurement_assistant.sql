create extension if not exists pgcrypto;

create table if not exists public.alert_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_type text not null check (alert_type in ('opportunity_match','tender_amendment','deadline','buyer_activity','award','supplier_activity','document_expiry','workspace_reminder','system')),
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  whatsapp_enabled boolean not null default false,
  frequency text not null default 'daily' check (frequency in ('instant','daily','weekly')),
  urgent_override boolean not null default false,
  reminder_days integer[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, alert_type)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  type text not null check (type in ('opportunity_match','tender_amendment','deadline','buyer_activity','award','supplier_activity','document_expiry','workspace_reminder','system')),
  title text not null,
  message text not null,
  related_entity_type text,
  related_entity_id uuid,
  related_url text,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  match_score integer check (match_score between 0 and 100),
  match_reasons jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index if not exists notifications_user_unread_idx on public.notifications(user_id, created_at desc) where read_at is null and dismissed_at is null;
create index if not exists notifications_user_type_idx on public.notifications(user_id, type, created_at desc);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel text not null check (channel in ('in_app','email','whatsapp')),
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','skipped')),
  provider text,
  provider_message_id text,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  retry_count integer not null default 0 check (retry_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_id, channel)
);

create index if not exists notification_deliveries_queue_idx on public.notification_deliveries(status, scheduled_for);

create table if not exists public.watched_entities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('buyer','supplier','opportunity')),
  entity_id uuid,
  entity_name text,
  created_at timestamptz not null default now(),
  check (entity_id is not null or nullif(trim(entity_name), '') is not null)
);

create unique index if not exists watched_entities_id_unique on public.watched_entities(user_id, entity_type, entity_id) where entity_id is not null;
create unique index if not exists watched_entities_name_unique on public.watched_entities(user_id, entity_type, lower(entity_name)) where entity_name is not null;

create table if not exists public.procurement_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('OPPORTUNITY_CREATED','OPPORTUNITY_UPDATED','OPPORTUNITY_AMENDED','DEADLINE_APPROACHING','AWARD_CREATED','BUYER_ACTIVITY_CREATED','DOCUMENT_EXPIRING','MATCH_CREATED','WORKSPACE_REMINDER')),
  entity_type text not null,
  entity_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  occurred_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  retry_count integer not null default 0
);

create index if not exists procurement_events_pending_idx on public.procurement_events(occurred_at) where processed_at is null;

create table if not exists public.opportunity_revisions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.procurement_opportunities(id) on delete cascade,
  source_id uuid references public.procurement_sources(id) on delete set null,
  source_hash text,
  snapshot jsonb not null,
  changed_fields jsonb not null default '[]'::jsonb,
  verified_at timestamptz not null default now(),
  unique (opportunity_id, source_hash)
);

create index if not exists opportunity_revisions_opportunity_idx on public.opportunity_revisions(opportunity_id, verified_at desc);

create table if not exists public.supplier_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  document_type text not null,
  title text not null,
  storage_path text,
  source_url text,
  issued_at date,
  expires_at date,
  verification_status text not null default 'needs_review' check (verification_status in ('verified','needs_review','rejected')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists supplier_documents_expiry_idx on public.supplier_documents(expires_at) where expires_at is not null;

alter table public.opportunity_documents add column if not exists source_name text;
alter table public.opportunity_documents add column if not exists version integer not null default 1;
alter table public.opportunity_documents add column if not exists uploaded_at timestamptz not null default now();
alter table public.opportunity_documents add column if not exists indexed_at timestamptz;
alter table public.opportunity_documents add column if not exists processing_status text not null default 'pending';
alter table public.opportunity_documents add column if not exists extracted_text text;
alter table public.opportunity_documents add column if not exists extraction_error text;

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.opportunity_documents(id) on delete cascade,
  chunk_index integer not null,
  page_number integer,
  section_label text,
  content text not null,
  token_estimate integer not null default 0,
  search_document tsvector generated always as (to_tsvector('english', coalesce(content, ''))) stored,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists document_chunks_search_idx on public.document_chunks using gin(search_document);

create table if not exists public.ai_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  opportunity_id uuid references public.procurement_opportunities(id) on delete cascade,
  workspace_id uuid,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ai_threads(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  citation_metadata jsonb not null default '[]'::jsonb,
  grounding_status text check (grounding_status in ('verified','mixed','not_found')),
  created_at timestamptz not null default now()
);

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  thread_id uuid references public.ai_threads(id) on delete set null,
  provider text not null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  estimated_units integer not null default 1,
  status text not null check (status in ('succeeded','failed','limited')),
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_date_idx on public.ai_usage(user_id, created_at desc);

create or replace function public.initialize_alert_preferences()
returns trigger language plpgsql security definer set search_path = public as $$
declare kind text;
begin
  foreach kind in array array['opportunity_match','tender_amendment','deadline','buyer_activity','award','supplier_activity','document_expiry','workspace_reminder','system'] loop
    insert into public.alert_preferences(user_id, alert_type, in_app_enabled, email_enabled, frequency, urgent_override, reminder_days)
    values (new.id, kind, true, false, 'daily', kind in ('tender_amendment','deadline','document_expiry'),
      case when kind = 'deadline' then array[7,3,1] when kind = 'document_expiry' then array[30,14,7,1] else '{}'::integer[] end)
    on conflict (user_id, alert_type) do nothing;
  end loop;
  return new;
end;
$$;

drop trigger if exists on_auth_user_alert_preferences on auth.users;
create trigger on_auth_user_alert_preferences after insert on auth.users for each row execute function public.initialize_alert_preferences();

insert into public.alert_preferences(user_id, alert_type, in_app_enabled, email_enabled, frequency, urgent_override, reminder_days)
select u.id, kind, true, false, 'daily', kind in ('tender_amendment','deadline','document_expiry'),
  case when kind = 'deadline' then array[7,3,1] when kind = 'document_expiry' then array[30,14,7,1] else '{}'::integer[] end
from auth.users u cross join unnest(array['opportunity_match','tender_amendment','deadline','buyer_activity','award','supplier_activity','document_expiry','workspace_reminder','system']) kind
on conflict (user_id, alert_type) do nothing;

alter table public.alert_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.watched_entities enable row level security;
alter table public.procurement_events enable row level security;
alter table public.opportunity_revisions enable row level security;
alter table public.supplier_documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.ai_threads enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_usage enable row level security;

create policy alert_preferences_owner_all on public.alert_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_owner_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_owner_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_owner_delete on public.notifications for delete to authenticated using (user_id = auth.uid());
create policy notification_deliveries_owner_read on public.notification_deliveries for select to authenticated using (exists (select 1 from public.notifications n where n.id = notification_id and n.user_id = auth.uid()));
create policy watched_entities_owner_all on public.watched_entities for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy supplier_documents_member_read on public.supplier_documents for select to authenticated using (public.is_organization_member(organization_id));
create policy supplier_documents_member_insert on public.supplier_documents for insert to authenticated with check (public.is_organization_member(organization_id) and uploaded_by = auth.uid());
create policy supplier_documents_member_update on public.supplier_documents for update to authenticated using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
create policy supplier_documents_admin_delete on public.supplier_documents for delete to authenticated using (public.is_organization_admin(organization_id));
create policy ai_threads_owner_all on public.ai_threads for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ai_messages_owner_all on public.ai_messages for all to authenticated using (exists (select 1 from public.ai_threads t where t.id = thread_id and t.user_id = auth.uid())) with check (exists (select 1 from public.ai_threads t where t.id = thread_id and t.user_id = auth.uid()));
create policy ai_usage_owner_read on public.ai_usage for select to authenticated using (user_id = auth.uid());

revoke select on public.opportunity_documents from anon, authenticated;
grant select (id, opportunity_id, title, document_type, url, mime_type, size_bytes, checksum, created_at, source_name, version, uploaded_at, indexed_at, processing_status) on public.opportunity_documents to anon, authenticated;

grant select, insert, update, delete on public.alert_preferences, public.notifications, public.watched_entities, public.supplier_documents, public.ai_threads, public.ai_messages to authenticated;
grant select on public.notification_deliveries, public.ai_usage to authenticated;
grant all on public.alert_preferences, public.notifications, public.notification_deliveries, public.watched_entities, public.procurement_events, public.opportunity_revisions, public.supplier_documents, public.document_chunks, public.ai_threads, public.ai_messages, public.ai_usage to service_role;

drop trigger if exists alert_preferences_set_updated_at on public.alert_preferences;
create trigger alert_preferences_set_updated_at before update on public.alert_preferences for each row execute function public.set_updated_at();
drop trigger if exists notification_deliveries_set_updated_at on public.notification_deliveries;
create trigger notification_deliveries_set_updated_at before update on public.notification_deliveries for each row execute function public.set_updated_at();
drop trigger if exists supplier_documents_set_updated_at on public.supplier_documents;
create trigger supplier_documents_set_updated_at before update on public.supplier_documents for each row execute function public.set_updated_at();
drop trigger if exists ai_threads_set_updated_at on public.ai_threads;
create trigger ai_threads_set_updated_at before update on public.ai_threads for each row execute function public.set_updated_at();
