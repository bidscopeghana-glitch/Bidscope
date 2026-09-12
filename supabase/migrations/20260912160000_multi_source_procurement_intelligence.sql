create extension if not exists pgcrypto;

alter table public.profiles add column if not exists is_super_admin boolean not null default false;
alter table public.organizations add column if not exists services text[] not null default '{}';
alter table public.organizations add column if not exists products text[] not null default '{}';
alter table public.organizations add column if not exists certifications text[] not null default '{}';
alter table public.organizations add column if not exists preferred_regions text[] not null default '{}';
alter table public.organizations add column if not exists preferred_minimum_value numeric(18,2);
alter table public.organizations add column if not exists preferred_maximum_value numeric(18,2);
alter table public.organizations add column if not exists previous_contracts jsonb not null default '[]'::jsonb;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_super_admin = true
  );
$$;

revoke execute on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated, service_role;

create table if not exists public.procurement_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  organisation text not null,
  base_url text not null,
  country_code text not null default 'GH' check (char_length(country_code) = 2),
  integration_type text not null check (integration_type in ('API', 'OPEN_DATA', 'RSS', 'STRUCTURED_WEB', 'MANUAL', 'DISABLED')),
  implementation_status text not null check (implementation_status in ('LIVE', 'READY_API_REQUIRED', 'READY_MANUAL_CONFIGURATION_REQUIRED', 'UNSUPPORTED', 'NEEDS_REVIEW')),
  api_enabled boolean not null default false,
  api_key_required boolean not null default false,
  environment_key_name text,
  endpoint_url text,
  sync_enabled boolean not null default false,
  sync_frequency text not null default 'daily',
  next_sync_at timestamptz,
  last_sync_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  status text not null default 'PAUSED' check (status in ('ACTIVE', 'PAUSED', 'ERROR')),
  trust_level text not null default 'OFFICIAL' check (trust_level in ('VERIFIED_OFFICIAL', 'OFFICIAL', 'PUBLIC', 'NEEDS_REVIEW')),
  rate_limit_per_minute integer not null default 10 check (rate_limit_per_minute between 1 and 600),
  configuration jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.procurement_opportunities (
  id uuid primary key default gen_random_uuid(),
  bidscope_reference text not null unique,
  slug text not null unique,
  title text not null,
  summary text not null default '',
  description text not null default '',
  buyer_name text not null default '',
  buyer_normalized_id uuid references public.procuring_entities(id) on delete set null,
  buyer_type text,
  country text not null default 'Ghana',
  country_code text not null default 'GH' check (char_length(country_code) = 2),
  region text,
  sector text,
  category text not null default 'other' check (category in ('goods', 'works', 'services', 'consulting', 'other')),
  subcategory text,
  procurement_method text,
  contract_type text,
  currency text check (currency is null or char_length(currency) = 3),
  estimated_value numeric(18,2) check (estimated_value is null or estimated_value >= 0),
  minimum_value numeric(18,2) check (minimum_value is null or minimum_value >= 0),
  maximum_value numeric(18,2) check (maximum_value is null or maximum_value >= 0),
  published_at timestamptz,
  deadline_at timestamptz,
  opening_date timestamptz,
  award_date date,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'OPEN', 'CLOSED', 'CANCELLED', 'AWARDED', 'ARCHIVED')),
  source_id uuid references public.procurement_sources(id) on delete set null,
  source_name text not null,
  source_type text not null,
  external_opportunity_id text,
  external_reference text,
  source_resource_id text,
  official_source_url text not null,
  official_tender_url text,
  official_submission_url text,
  submission_platform text,
  submission_method text,
  requires_registration boolean not null default false,
  registration_url text,
  funding_source text not null default 'Other',
  funding_agency text,
  eligibility_text text,
  eligibility_country text,
  documents_url text,
  contact_name text,
  contact_email text,
  contact_phone text,
  last_source_update timestamptz,
  last_verified_at timestamptz,
  data_confidence text not null default 'PUBLIC_SOURCE' check (data_confidence in ('VERIFIED_OFFICIAL_SOURCE', 'OFFICIAL_SOURCE', 'PUBLIC_SOURCE', 'NEEDS_REVIEW', 'STALE')),
  verification_status text not null default 'NEEDS_REVIEW' check (verification_status in ('VERIFIED', 'OFFICIAL', 'NEEDS_REVIEW', 'STALE')),
  raw_source_hash text,
  document_fingerprint text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(buyer_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(external_reference, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(sector, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(funding_agency, '')), 'B')
  ) stored,
  check (minimum_value is null or maximum_value is null or minimum_value <= maximum_value)
);

create table if not exists public.opportunity_sources (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.procurement_opportunities(id) on delete cascade,
  source_id uuid not null references public.procurement_sources(id) on delete cascade,
  external_id text,
  official_url text not null,
  submission_url text,
  source_resource_id text,
  document_fingerprint text,
  is_preferred boolean not null default false,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id),
  unique (opportunity_id, source_id, official_url)
);

create table if not exists public.source_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.procurement_sources(id) on delete cascade,
  status text not null default 'RUNNING' check (status in ('RUNNING', 'SUCCEEDED', 'PARTIALLY_SUCCEEDED', 'FAILED')),
  triggered_by text not null default 'schedule' check (triggered_by in ('schedule', 'admin', 'manual_import')),
  actor_user_id uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  records_fetched integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  duplicate_count integer not null default 0,
  failed_count integer not null default 0,
  error_summary text,
  error_details jsonb not null default '[]'::jsonb
);

create table if not exists public.user_bid_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  opportunity_id uuid not null references public.procurement_opportunities(id) on delete cascade,
  status text not null default 'SAVED' check (status in ('SAVED', 'REVIEWING', 'PREPARING', 'READY_TO_SUBMIT', 'OFFICIAL_SUBMISSION_OPENED', 'SUBMITTED', 'AWARDED', 'UNSUCCESSFUL', 'WITHDRAWN')),
  saved_at timestamptz not null default now(),
  preparation_started_at timestamptz,
  official_submission_opened_at timestamptz,
  submitted_at timestamptz,
  submission_reference text,
  outcome text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, opportunity_id)
);

create table if not exists public.submission_clicks (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  opportunity_id uuid not null references public.procurement_opportunities(id) on delete cascade,
  source_id uuid references public.procurement_sources(id) on delete set null,
  destination_url text not null,
  clicked_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  opportunity_id uuid references public.procurement_opportunities(id) on delete set null,
  source_id uuid references public.procurement_sources(id) on delete set null,
  event_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists procurement_opportunities_search_idx on public.procurement_opportunities using gin(search_document);
create index if not exists procurement_opportunities_status_deadline_idx on public.procurement_opportunities(status, deadline_at);
create index if not exists procurement_opportunities_source_status_idx on public.procurement_opportunities(source_id, status);
create index if not exists procurement_opportunities_country_category_idx on public.procurement_opportunities(country_code, category);
create index if not exists procurement_opportunities_funding_idx on public.procurement_opportunities(funding_source, status);
create index if not exists procurement_opportunities_buyer_idx on public.procurement_opportunities(buyer_normalized_id);
create index if not exists procurement_opportunities_external_ref_idx on public.procurement_opportunities(lower(external_reference));
create index if not exists procurement_opportunities_fingerprint_idx on public.procurement_opportunities(document_fingerprint) where document_fingerprint is not null;
create index if not exists opportunity_sources_opportunity_idx on public.opportunity_sources(opportunity_id);
create index if not exists opportunity_sources_source_idx on public.opportunity_sources(source_id);
create index if not exists source_sync_runs_source_started_idx on public.source_sync_runs(source_id, started_at desc);
create index if not exists user_bid_tracking_user_status_idx on public.user_bid_tracking(user_id, status);
create index if not exists user_bid_tracking_organization_idx on public.user_bid_tracking(organization_id);
create index if not exists submission_clicks_opportunity_idx on public.submission_clicks(opportunity_id, clicked_at desc);
create index if not exists analytics_events_source_name_idx on public.analytics_events(source_id, event_name, created_at desc);
create index if not exists analytics_events_organization_idx on public.analytics_events(organization_id, created_at desc);

insert into public.procurement_sources
  (name, slug, organisation, base_url, country_code, integration_type, implementation_status, api_enabled, api_key_required, environment_key_name, endpoint_url, sync_enabled, sync_frequency, status, trust_level, configuration)
values
  ('GHANEPS', 'ghaneps', 'Ghana Electronic Procurement System', 'https://www.ghaneps.gov.gh/', 'GH', 'MANUAL', 'READY_MANUAL_CONFIGURATION_REQUIRED', false, false, null, null, false, 'daily', 'PAUSED', 'OFFICIAL', '{"reason":"No documented public aggregation API verified; exact official tender deep links are retained."}'::jsonb),
  ('MRH e-Bids', 'mrh-ebids', 'Ministry of Roads and Highways', 'https://bids.mrh.gov.gh/', 'GH', 'MANUAL', 'READY_MANUAL_CONFIGURATION_REQUIRED', false, false, null, null, false, 'daily', 'PAUSED', 'OFFICIAL', '{"reason":"Public portal verified; automated reuse requires technical and legal review."}'::jsonb),
  ('Bank of Ghana', 'bank-of-ghana', 'Bank of Ghana', 'https://www.bog.gov.gh/notice/invitation-for-tenders/', 'GH', 'MANUAL', 'READY_MANUAL_CONFIGURATION_REQUIRED', false, false, null, null, false, 'daily', 'PAUSED', 'OFFICIAL', '{"reason":"Official public notices verified; no public procurement API verified."}'::jsonb),
  ('UNGM', 'ungm', 'United Nations Global Marketplace', 'https://www.ungm.org/Public/Notice', 'GH', 'MANUAL', 'NEEDS_REVIEW', false, false, null, null, false, 'daily', 'PAUSED', 'OFFICIAL', '{"reason":"Public notices are free to view; no public third-party aggregation API was verified."}'::jsonb),
  ('African Development Bank', 'afdb', 'African Development Bank Group', 'https://www.afdb.org/en/documents/project-related-procurement/procurement-notices/specific-procurement-notices', 'GH', 'RSS', 'NEEDS_REVIEW', false, false, null, null, false, 'daily', 'PAUSED', 'OFFICIAL', '{"reason":"Official site advertises procurement RSS feeds; exact feed and reuse conditions require validation."}'::jsonb),
  ('World Bank', 'world-bank', 'World Bank Group', 'https://projects.worldbank.org/en/projects-operations/procurement', 'GH', 'OPEN_DATA', 'LIVE', true, false, null, 'https://search.worldbank.org/api/v2/procnotices', true, '4 hours', 'ACTIVE', 'VERIFIED_OFFICIAL', '{"country_filter":"Ghana","license":"CC BY 4.0"}'::jsonb)
on conflict (slug) do update set
  name = excluded.name,
  organisation = excluded.organisation,
  base_url = excluded.base_url,
  integration_type = excluded.integration_type,
  implementation_status = excluded.implementation_status,
  api_enabled = excluded.api_enabled,
  api_key_required = excluded.api_key_required,
  environment_key_name = excluded.environment_key_name,
  endpoint_url = excluded.endpoint_url,
  sync_enabled = excluded.sync_enabled,
  sync_frequency = excluded.sync_frequency,
  status = excluded.status,
  trust_level = excluded.trust_level,
  configuration = excluded.configuration;

insert into public.procurement_opportunities (
  id, bidscope_reference, slug, title, summary, description, buyer_name, buyer_normalized_id, buyer_type,
  country, country_code, region, sector, category, procurement_method, currency, estimated_value,
  published_at, deadline_at, status, source_id, source_name, source_type, external_opportunity_id,
  external_reference, official_source_url, official_tender_url, funding_source, eligibility_text,
  documents_url, contact_name, contact_email, contact_phone, last_source_update, last_verified_at,
  data_confidence, verification_status, raw_source_hash, raw_payload, created_at, updated_at
)
select
  o.id,
  'BS-' || upper(substr(replace(o.id::text, '-', ''), 1, 10)),
  o.slug, o.title, o.summary, o.description, coalesce(pe.name, ''), o.buyer_id, pe.entity_type,
  case when o.country_code = 'GH' then 'Ghana' else o.country_code end,
  o.country_code, o.region, nullif(array_to_string(o.sectors, ', '), ''), o.category,
  o.procurement_method, o.currency, o.estimated_value,
  coalesce(o.published_at, o.publication_date::timestamptz), o.deadline,
  upper(o.status), ps.id, coalesce(src.name, 'GHANEPS'), upper(coalesce(src.source_type, 'MANUAL')),
  o.source_key, o.reference_number, o.source_url, o.source_url,
  case when o.country_code = 'GH' then 'Government of Ghana' else 'Other' end,
  o.eligibility, o.source_document_url, o.contact ->> 'name', o.contact ->> 'email', o.contact ->> 'phone',
  o.updated_at, o.updated_at, 'OFFICIAL_SOURCE', 'OFFICIAL', o.content_hash, o.raw_payload, o.created_at, o.updated_at
from public.opportunities o
left join public.procuring_entities pe on pe.id = o.buyer_id
left join public.ingestion_sources src on src.id = o.source_id
left join public.procurement_sources ps on ps.slug = case lower(coalesce(src.name, 'ghaneps'))
  when 'ghaneps' then 'ghaneps' else 'ghaneps' end
on conflict (id) do nothing;

insert into public.opportunity_sources (opportunity_id, source_id, external_id, official_url, submission_url, is_preferred, last_verified_at)
select po.id, po.source_id, po.external_opportunity_id, po.official_source_url, po.official_submission_url, true, po.last_verified_at
from public.procurement_opportunities po
where po.source_id is not null
on conflict (source_id, external_id) do nothing;

alter table public.saved_opportunities drop constraint if exists saved_opportunities_opportunity_id_fkey;
alter table public.opportunity_documents drop constraint if exists opportunity_documents_opportunity_id_fkey;
alter table public.awards drop constraint if exists awards_opportunity_id_fkey;
alter table public.alert_deliveries drop constraint if exists alert_deliveries_opportunity_id_fkey;

alter table public.saved_opportunities add constraint saved_opportunities_opportunity_id_fkey foreign key (opportunity_id) references public.procurement_opportunities(id) on delete cascade;
alter table public.opportunity_documents add constraint opportunity_documents_opportunity_id_fkey foreign key (opportunity_id) references public.procurement_opportunities(id) on delete cascade;
alter table public.awards add constraint awards_opportunity_id_fkey foreign key (opportunity_id) references public.procurement_opportunities(id) on delete set null;
alter table public.alert_deliveries add constraint alert_deliveries_opportunity_id_fkey foreign key (opportunity_id) references public.procurement_opportunities(id) on delete cascade;

drop trigger if exists procurement_sources_set_updated_at on public.procurement_sources;
create trigger procurement_sources_set_updated_at before update on public.procurement_sources for each row execute function public.set_updated_at();
drop trigger if exists procurement_opportunities_set_updated_at on public.procurement_opportunities;
create trigger procurement_opportunities_set_updated_at before update on public.procurement_opportunities for each row execute function public.set_updated_at();
drop trigger if exists opportunity_sources_set_updated_at on public.opportunity_sources;
create trigger opportunity_sources_set_updated_at before update on public.opportunity_sources for each row execute function public.set_updated_at();
drop trigger if exists user_bid_tracking_set_updated_at on public.user_bid_tracking;
create trigger user_bid_tracking_set_updated_at before update on public.user_bid_tracking for each row execute function public.set_updated_at();

create or replace function public.close_expired_procurement_opportunities()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare affected integer;
begin
  update public.procurement_opportunities
  set status = 'CLOSED'
  where status = 'OPEN' and deadline_at is not null and deadline_at < now();
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke execute on function public.close_expired_procurement_opportunities() from public, anon, authenticated;
grant execute on function public.close_expired_procurement_opportunities() to service_role;

alter table public.procurement_sources enable row level security;
alter table public.procurement_opportunities enable row level security;
alter table public.opportunity_sources enable row level security;
alter table public.source_sync_runs enable row level security;
alter table public.user_bid_tracking enable row level security;
alter table public.submission_clicks enable row level security;
alter table public.analytics_events enable row level security;

drop policy if exists procurement_sources_public_read on public.procurement_sources;
drop policy if exists procurement_sources_admin_manage on public.procurement_sources;
drop policy if exists procurement_opportunities_public_read on public.procurement_opportunities;
drop policy if exists opportunity_sources_public_read on public.opportunity_sources;
drop policy if exists source_sync_runs_admin_read on public.source_sync_runs;
drop policy if exists user_bid_tracking_self_read on public.user_bid_tracking;
drop policy if exists user_bid_tracking_self_insert on public.user_bid_tracking;
drop policy if exists user_bid_tracking_self_update on public.user_bid_tracking;
drop policy if exists user_bid_tracking_self_delete on public.user_bid_tracking;
drop policy if exists submission_clicks_self_read on public.submission_clicks;
drop policy if exists submission_clicks_self_insert on public.submission_clicks;
drop policy if exists analytics_events_admin_read on public.analytics_events;
drop policy if exists analytics_events_self_insert on public.analytics_events;

create policy procurement_sources_public_read on public.procurement_sources for select to anon, authenticated using (true);
create policy procurement_sources_admin_manage on public.procurement_sources for all to authenticated using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy procurement_opportunities_public_read on public.procurement_opportunities for select to anon, authenticated using (published_at is not null and status <> 'DRAFT');
create policy opportunity_sources_public_read on public.opportunity_sources for select to anon, authenticated using (exists (select 1 from public.procurement_opportunities p where p.id = opportunity_id and p.published_at is not null and p.status <> 'DRAFT'));
create policy source_sync_runs_admin_read on public.source_sync_runs for select to authenticated using ((select public.is_super_admin()));
create policy user_bid_tracking_self_read on public.user_bid_tracking for select to authenticated using (user_id = (select auth.uid()));
create policy user_bid_tracking_self_insert on public.user_bid_tracking for insert to authenticated with check (user_id = (select auth.uid()) and (organization_id is null or public.is_organization_member(organization_id)));
create policy user_bid_tracking_self_update on public.user_bid_tracking for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and (organization_id is null or public.is_organization_member(organization_id)));
create policy user_bid_tracking_self_delete on public.user_bid_tracking for delete to authenticated using (user_id = (select auth.uid()));
create policy submission_clicks_self_read on public.submission_clicks for select to authenticated using (user_id = (select auth.uid()));
create policy submission_clicks_self_insert on public.submission_clicks for insert to authenticated with check (user_id = (select auth.uid()));
create policy analytics_events_admin_read on public.analytics_events for select to authenticated using ((select public.is_super_admin()));
create policy analytics_events_self_insert on public.analytics_events for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists opportunity_documents_public_read on public.opportunity_documents;
create policy opportunity_documents_public_read on public.opportunity_documents for select to anon, authenticated using (exists (select 1 from public.procurement_opportunities o where o.id = opportunity_id and o.published_at is not null and o.status <> 'DRAFT'));

grant usage on schema public to anon, authenticated, service_role;
grant select on public.procurement_sources to anon, authenticated;
grant select on public.procurement_opportunities to anon, authenticated;
grant select on public.opportunity_sources to anon, authenticated;
grant select, insert, update, delete on public.user_bid_tracking to authenticated;
grant select, insert on public.submission_clicks to authenticated;
grant insert on public.analytics_events to authenticated;
grant select on public.source_sync_runs to authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name, phone, job_title, updated_at) on public.profiles to authenticated;
revoke update on public.organizations from authenticated;
grant update (name, registration_number, website, phone, region, sectors, company_size, services, products, certifications, preferred_regions, preferred_minimum_value, preferred_maximum_value, previous_contracts, updated_at) on public.organizations to authenticated;
grant all on public.procurement_sources, public.procurement_opportunities, public.opportunity_sources, public.source_sync_runs, public.user_bid_tracking, public.submission_clicks, public.analytics_events to service_role;
grant usage, select on all sequences in schema public to service_role;
