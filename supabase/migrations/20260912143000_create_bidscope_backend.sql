create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text not null default '',
  job_title text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  registration_number text,
  website text,
  phone text,
  country_code text not null default 'GH' check (char_length(country_code) = 2),
  region text,
  sectors text[] not null default '{}',
  company_size text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.create_organization_with_owner(
  organization_name text,
  organization_slug text,
  organization_sectors text[] default '{}',
  organization_region text default null
)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  created public.organizations;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  insert into public.organizations (name, slug, sectors, region, created_by)
  values (organization_name, organization_slug, organization_sectors, organization_region, auth.uid())
  returning * into created;
  insert into public.organization_members (organization_id, user_id, role)
  values (created.id, auth.uid(), 'owner');
  return created;
end;
$$;

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_organization_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_organization_admin(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_organization_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

create table if not exists public.procuring_entities (
  id uuid primary key default gen_random_uuid(),
  country_code text not null default 'GH' check (char_length(country_code) = 2),
  name text not null,
  slug text not null,
  entity_type text,
  region text,
  website text,
  source_url text,
  description text,
  contact jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_code, slug)
);

create table if not exists public.ingestion_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_type text not null check (source_type in ('api', 'rss', 'web', 'manual', 'file')),
  country_code text not null default 'GH',
  base_url text,
  enabled boolean not null default true,
  schedule text,
  configuration jsonb not null default '{}'::jsonb,
  last_success_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, country_code)
);

create table if not exists public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.ingestion_sources(id) on delete set null,
  status text not null default 'running' check (status in ('running', 'succeeded', 'partially_succeeded', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  discovered_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  rejected_count integer not null default 0,
  error_summary text,
  metadata jsonb not null default '{}'::jsonb
);

insert into public.ingestion_sources (name, source_type, country_code, base_url, enabled, schedule, configuration)
values ('GHANEPS', 'web', 'GH', 'https://www.ghaneps.gov.gh/', true, 'daily', '{"requires_adapter":true,"official_source":true}'::jsonb)
on conflict (name, country_code) do nothing;

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.ingestion_sources(id) on delete set null,
  source_key text not null,
  country_code text not null default 'GH' check (char_length(country_code) = 2),
  slug text not null unique,
  reference_number text,
  title text not null,
  summary text not null default '',
  description text not null default '',
  category text not null check (category in ('goods', 'works', 'services', 'consulting', 'other')),
  sectors text[] not null default '{}',
  procurement_method text,
  buyer_id uuid references public.procuring_entities(id) on delete set null,
  region text,
  currency text,
  estimated_value numeric(18,2),
  publication_date date,
  deadline timestamptz,
  status text not null default 'draft' check (status in ('draft', 'open', 'closed', 'cancelled', 'awarded', 'archived')),
  source_url text not null,
  source_document_url text,
  eligibility text,
  contact jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  content_hash text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(reference_number, '')), 'A')
  ) stored,
  unique (country_code, source_key)
);

create index if not exists opportunities_search_idx on public.opportunities using gin(search_document);
create index if not exists opportunities_status_deadline_idx on public.opportunities(status, deadline);
create index if not exists opportunities_country_category_idx on public.opportunities(country_code, category);
create index if not exists opportunities_buyer_idx on public.opportunities(buyer_id);
create index if not exists opportunities_sectors_idx on public.opportunities using gin(sectors);

create table if not exists public.opportunity_documents (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  title text not null,
  document_type text,
  url text not null,
  mime_type text,
  size_bytes bigint,
  checksum text,
  created_at timestamptz not null default now(),
  unique (opportunity_id, url)
);

create table if not exists public.awards (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.ingestion_sources(id) on delete set null,
  source_key text not null,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  buyer_id uuid references public.procuring_entities(id) on delete set null,
  country_code text not null default 'GH',
  title text not null,
  reference_number text,
  award_date date,
  currency text,
  award_value numeric(18,2),
  procurement_method text,
  source_url text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_code, source_key)
);

create index if not exists awards_buyer_date_idx on public.awards(buyer_id, award_date desc);
create index if not exists awards_country_date_idx on public.awards(country_code, award_date desc);

create table if not exists public.award_suppliers (
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null references public.awards(id) on delete cascade,
  supplier_name text not null,
  supplier_registration_number text,
  country_code text,
  awarded_value numeric(18,2),
  is_joint_venture boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists award_suppliers_name_idx on public.award_suppliers(lower(supplier_name));

create table if not exists public.saved_opportunities (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  saved_by uuid not null references auth.users(id) on delete cascade,
  notes text not null default '',
  pipeline_stage text not null default 'watching' check (pipeline_stage in ('watching', 'reviewing', 'preparing', 'submitted', 'won', 'lost')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, opportunity_id)
);

create table if not exists public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  enabled boolean not null default true,
  frequency text not null default 'daily' check (frequency in ('instant', 'daily', 'weekly')),
  keywords text[] not null default '{}',
  excluded_keywords text[] not null default '{}',
  categories text[] not null default '{}',
  sectors text[] not null default '{}',
  regions text[] not null default '{}',
  buyer_ids uuid[] not null default '{}',
  minimum_value numeric(18,2),
  maximum_value numeric(18,2),
  deadline_days_min integer,
  deadline_days_max integer,
  email_recipients text[] not null default '{}',
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists alert_rules_org_enabled_idx on public.alert_rules(organization_id, enabled);

create table if not exists public.alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  alert_rule_id uuid not null references public.alert_rules(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  recipient text not null,
  channel text not null default 'email' check (channel in ('email', 'whatsapp', 'in_app')),
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'suppressed')),
  provider_message_id text,
  error_message text,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (alert_rule_id, opportunity_id, recipient, channel)
);

create index if not exists alert_deliveries_status_idx on public.alert_deliveries(status, queued_at);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null default 'manual',
  provider_customer_id text,
  provider_subscription_id text,
  plan_code text not null default 'founding',
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'paused', 'cancelled', 'expired')),
  trial_ends_at timestamptz,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processed', 'failed', 'ignored')),
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_org_created_idx on public.audit_log(organization_id, created_at desc);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at before update on public.organizations for each row execute function public.set_updated_at();
drop trigger if exists procuring_entities_set_updated_at on public.procuring_entities;
create trigger procuring_entities_set_updated_at before update on public.procuring_entities for each row execute function public.set_updated_at();
drop trigger if exists ingestion_sources_set_updated_at on public.ingestion_sources;
create trigger ingestion_sources_set_updated_at before update on public.ingestion_sources for each row execute function public.set_updated_at();
drop trigger if exists opportunities_set_updated_at on public.opportunities;
create trigger opportunities_set_updated_at before update on public.opportunities for each row execute function public.set_updated_at();
drop trigger if exists awards_set_updated_at on public.awards;
create trigger awards_set_updated_at before update on public.awards for each row execute function public.set_updated_at();
drop trigger if exists saved_opportunities_set_updated_at on public.saved_opportunities;
create trigger saved_opportunities_set_updated_at before update on public.saved_opportunities for each row execute function public.set_updated_at();
drop trigger if exists alert_rules_set_updated_at on public.alert_rules;
create trigger alert_rules_set_updated_at before update on public.alert_rules for each row execute function public.set_updated_at();
drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.procuring_entities enable row level security;
alter table public.ingestion_sources enable row level security;
alter table public.ingestion_runs enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_documents enable row level security;
alter table public.awards enable row level security;
alter table public.award_suppliers enable row level security;
alter table public.saved_opportunities enable row level security;
alter table public.alert_rules enable row level security;
alter table public.alert_deliveries enable row level security;
alter table public.subscriptions enable row level security;
alter table public.webhook_events enable row level security;
alter table public.audit_log enable row level security;

create policy "profiles_read_self" on public.profiles for select using (id = auth.uid());
create policy "profiles_update_self" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "organizations_read_member" on public.organizations for select using (public.is_organization_member(id));
create policy "organizations_update_admin" on public.organizations for update using (public.is_organization_admin(id)) with check (public.is_organization_admin(id));
create policy "organization_members_read_member" on public.organization_members for select using (public.is_organization_member(organization_id));
create policy "organization_members_manage_admin" on public.organization_members for all using (public.is_organization_admin(organization_id)) with check (public.is_organization_admin(organization_id));
create policy "buyers_public_read" on public.procuring_entities for select using (true);
create policy "opportunities_public_read" on public.opportunities for select using (published_at is not null and status <> 'draft');
create policy "opportunity_documents_public_read" on public.opportunity_documents for select using (exists (select 1 from public.opportunities o where o.id = opportunity_id and o.published_at is not null and o.status <> 'draft'));
create policy "awards_public_read" on public.awards for select using (published_at is not null);
create policy "award_suppliers_public_read" on public.award_suppliers for select using (exists (select 1 from public.awards a where a.id = award_id and a.published_at is not null));
create policy "saved_opportunities_member_access" on public.saved_opportunities for all using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id) and saved_by = auth.uid());
create policy "alert_rules_member_read" on public.alert_rules for select using (public.is_organization_member(organization_id));
create policy "alert_rules_member_insert" on public.alert_rules for insert with check (public.is_organization_member(organization_id) and created_by = auth.uid());
create policy "alert_rules_owner_update" on public.alert_rules for update using (created_by = auth.uid() or public.is_organization_admin(organization_id)) with check (public.is_organization_member(organization_id));
create policy "alert_rules_owner_delete" on public.alert_rules for delete using (created_by = auth.uid() or public.is_organization_admin(organization_id));
create policy "alert_deliveries_member_read" on public.alert_deliveries for select using (exists (select 1 from public.alert_rules r where r.id = alert_rule_id and public.is_organization_member(r.organization_id)));
create policy "subscriptions_member_read" on public.subscriptions for select using (public.is_organization_member(organization_id));
create policy "audit_log_admin_read" on public.audit_log for select using (public.is_organization_admin(organization_id));

grant usage on schema public to anon, authenticated, service_role;
grant select (id, country_code, name, slug, entity_type, region, website, source_url, description, contact, created_at, updated_at) on public.procuring_entities to anon, authenticated;
grant select (id, country_code, slug, reference_number, title, summary, description, category, sectors, procurement_method, buyer_id, region, currency, estimated_value, publication_date, deadline, status, source_url, source_document_url, eligibility, contact, published_at, created_at, updated_at) on public.opportunities to anon, authenticated;
grant select on public.opportunity_documents to anon, authenticated;
grant select (id, opportunity_id, buyer_id, country_code, title, reference_number, award_date, currency, award_value, procurement_method, source_url, published_at, created_at, updated_at) on public.awards to anon, authenticated;
grant select (id, award_id, supplier_name, supplier_registration_number, country_code, awarded_value, is_joint_venture) on public.award_suppliers to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_members, public.saved_opportunities, public.alert_rules to authenticated;
grant select on public.alert_deliveries, public.subscriptions, public.audit_log to authenticated;
grant execute on function public.create_organization_with_owner(text, text, text[], text) to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
