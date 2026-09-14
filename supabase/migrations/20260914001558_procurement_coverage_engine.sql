-- BidScope procurement coverage engine. Source metadata is explicit so that an
-- unverified or credential-gated connector can never masquerade as live.
alter table public.procurement_sources drop constraint if exists procurement_sources_implementation_status_check;
alter table public.procurement_sources add constraint procurement_sources_implementation_status_check check (implementation_status in (
  'LIVE','AUTHORIZATION_REQUIRED','API_KEY_REQUIRED','CONFIGURATION_REQUIRED','RESEARCH_REQUIRED','UNAVAILABLE',
  'READY_API_REQUIRED','READY_MANUAL_CONFIGURATION_REQUIRED','UNSUPPORTED','NEEDS_REVIEW'
));
alter table public.procurement_sources drop constraint if exists procurement_sources_status_check;
alter table public.procurement_sources add constraint procurement_sources_status_check check (status in ('ACTIVE','DEGRADED','PAUSED','ERROR','UNAVAILABLE'));

alter table public.procurement_sources
  add column if not exists source_scope text not null default 'GHANA',
  add column if not exists access_classification text not null default 'RESEARCH_REQUIRED',
  add column if not exists reuse_basis text,
  add column if not exists robots_status text,
  add column if not exists terms_url text,
  add column if not exists coverage_notes text,
  add column if not exists consecutive_failures integer not null default 0,
  add column if not exists last_record_at timestamptz,
  add column if not exists last_health_at timestamptz,
  add column if not exists last_health_message text,
  add column if not exists sync_cursor jsonb not null default '{}'::jsonb;

alter table public.procurement_opportunities drop constraint if exists procurement_opportunities_status_check;
alter table public.procurement_opportunities add constraint procurement_opportunities_status_check check (status in ('UPCOMING','OPEN','CLOSING_SOON','CLOSED','AWARDED','CANCELLED','DRAFT','ARCHIVED','UNKNOWN'));
alter table public.procurement_opportunities
  add column if not exists notice_stage text not null default 'OTHER' check (notice_stage in ('FORECAST','PLANNED','OPEN','AWARD','OTHER')),
  add column if not exists eligibility_status text not null default 'UNCLEAR' check (eligibility_status in ('GHANA_ELIGIBLE','INTERNATIONAL_ELIGIBLE','RESTRICTED','UNCLEAR')),
  add column if not exists eligibility_summary text,
  add column if not exists first_seen_at timestamptz not null default now(),
  add column if not exists source_removed_at timestamptz,
  add column if not exists quality_score smallint not null default 50 check (quality_score between 0 and 100),
  add column if not exists rejection_reason text;

create table if not exists public.procurement_source_research (
  id uuid primary key default gen_random_uuid(), source_id uuid not null references public.procurement_sources(id) on delete cascade,
  researched_at timestamptz not null default now(), official_document_url text not null, finding_type text not null,
  finding text not null, evidence jsonb not null default '{}'::jsonb, unique(source_id, official_document_url, finding_type)
);
create table if not exists public.procurement_raw_records (
  id bigint generated always as identity primary key, source_id uuid not null references public.procurement_sources(id) on delete cascade,
  sync_run_id uuid references public.source_sync_runs(id) on delete set null, external_id text, source_hash text not null,
  payload jsonb not null, fetched_at timestamptz not null default now(), normalization_status text not null default 'PENDING' check (normalization_status in ('PENDING','ACCEPTED','REJECTED','FAILED')),
  rejection_reason text, unique(source_id, source_hash)
);
create table if not exists public.procurement_source_alerts (
  id uuid primary key default gen_random_uuid(), source_id uuid not null references public.procurement_sources(id) on delete cascade,
  sync_run_id uuid references public.source_sync_runs(id) on delete set null, severity text not null check (severity in ('INFO','WARNING','CRITICAL')),
  alert_type text not null, message text not null, details jsonb not null default '{}'::jsonb, resolved_at timestamptz, created_at timestamptz not null default now()
);

create index if not exists procurement_opportunities_live_country_deadline_idx on public.procurement_opportunities(country_code, deadline_at) where status in ('OPEN','CLOSING_SOON');
create index if not exists procurement_opportunities_upcoming_idx on public.procurement_opportunities(published_at desc) where status = 'UPCOMING';
create index if not exists procurement_opportunities_eligibility_idx on public.procurement_opportunities(eligibility_status, deadline_at) where status in ('OPEN','CLOSING_SOON');
create index if not exists procurement_raw_records_source_fetched_idx on public.procurement_raw_records(source_id, fetched_at desc);
create index if not exists procurement_source_alerts_open_idx on public.procurement_source_alerts(source_id, created_at desc) where resolved_at is null;
create index if not exists procurement_source_research_source_idx on public.procurement_source_research(source_id, researched_at desc);

alter table public.procurement_source_research enable row level security;
alter table public.procurement_raw_records enable row level security;
alter table public.procurement_source_alerts enable row level security;
revoke all on table public.procurement_source_research, public.procurement_raw_records, public.procurement_source_alerts from anon, authenticated;
grant select on table public.procurement_source_research, public.procurement_raw_records, public.procurement_source_alerts to authenticated;
grant all on table public.procurement_source_research, public.procurement_raw_records, public.procurement_source_alerts to service_role;
create policy procurement_source_research_admin_read on public.procurement_source_research for select to authenticated using ((select public.is_super_admin()));
create policy procurement_raw_records_admin_read on public.procurement_raw_records for select to authenticated using ((select public.is_super_admin()));
create policy procurement_source_alerts_admin_read on public.procurement_source_alerts for select to authenticated using ((select public.is_super_admin()));

insert into public.procurement_sources (name,slug,organisation,base_url,country_code,integration_type,implementation_status,api_enabled,api_key_required,environment_key_name,endpoint_url,sync_enabled,sync_frequency,status,trust_level,rate_limit_per_minute,source_scope,access_classification,reuse_basis,robots_status,terms_url,coverage_notes,configuration)
values
('GHANEPS','ghaneps','Ghana Electronic Procurement System','https://www.ghaneps.gov.gh/epps/home.do','GH','STRUCTURED_WEB','LIVE',true,false,null,'https://www.ghaneps.gov.gh/epps/viewCFTSAction.do',true,'4 hours','ACTIVE','VERIFIED_OFFICIAL',8,'GHANA','PERMITTED_WEB_INGESTION','Public tender metadata and official links; no documented public API or explicit reuse licence located.','NOT_PUBLISHED',null,'Current tenders, plans and awards are publicly searchable. Connector indexes metadata conservatively and links to the official record.','{"pagination":"T01_ps=100 and d-3680175-p","metadata_only":true}'::jsonb),
('Ghana Roads Procurement','mrh-procurement','Ministry of Roads and Highways','https://mrh.gov.gh/category/procurement-notices/','GH','OPEN_API','LIVE',true,false,null,'https://mrh.gov.gh/wp-json/wp/v2/posts?categories=29',true,'6 hours','ACTIVE','VERIFIED_OFFICIAL',20,'GHANA','PERMITTED_API','Official WordPress REST endpoint for the ministry procurement-notice category.','ALLOWED','https://mrh.gov.gh/robots.txt','Procurement notices and official document links.','{"wp_category_id":29}'::jsonb),
('Bank of Ghana','bank-of-ghana','Bank of Ghana','https://www.bog.gov.gh/notice/invitation-for-tenders/','GH','OPEN_API','LIVE',true,false,null,'https://www.bog.gov.gh/wp-json/wp/v2/notice',true,'12 hours','ACTIVE','VERIFIED_OFFICIAL',20,'GHANA','PERMITTED_API','Official WordPress REST notice collection; only procurement-titled records are accepted.','NOT_PUBLISHED',null,'Records without an extractable deadline remain UNKNOWN and never enter the live feed.','{"quality_gate":"procurement title required"}'::jsonb),
('African Union','african-union','African Union','https://au.int/en/bids','ZZ','STRUCTURED_WEB','LIVE',true,false,null,'https://au.int/en/bids',true,'6 hours','ACTIVE','VERIFIED_OFFICIAL',10,'INTERNATIONAL','PERMITTED_WEB_INGESTION','robots.txt Content-Signal permits search and reference use; metadata and links only.','ALLOWED','https://au.int/robots.txt','AU bids; country eligibility is never inferred.','{"metadata_only":true}'::jsonb),
('ECOWAS','ecowas','Economic Community of West African States','https://www.ecowas.int/event_advert/procurements/','ZZ','STRUCTURED_WEB','LIVE',true,false,null,'https://www.ecowas.int/event_advert/procurements/',true,'6 hours','ACTIVE','VERIFIED_OFFICIAL',10,'INTERNATIONAL','PERMITTED_WEB_INGESTION','Public official procurement listing; metadata and links only.','ALLOWED','https://www.ecowas.int/robots.txt','Regional procurement; non-procurement programme and vacancy cards are rejected.','{"metadata_only":true}'::jsonb),
('Tenders Electronic Daily','ted-eu','Publications Office of the European Union','https://ted.europa.eu/','EU','OPEN_API','LIVE',true,false,null,'https://api.ted.europa.eu/v3/notices/search',true,'6 hours','ACTIVE','VERIFIED_OFFICIAL',20,'INTERNATIONAL','PERMITTED_API','Official TED Search API for published notices.','API','https://docs.ted.europa.eu/api/latest/search.html','Only notices with current receipt deadlines are requested; eligibility remains unconfirmed.','{"api_version":"v3","page_size":100}'::jsonb),
('UK Contracts Finder','uk-contracts-finder','UK Cabinet Office','https://www.contractsfinder.service.gov.uk/','GB','OPEN_API','LIVE',true,false,null,'https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search',true,'6 hours','ACTIVE','VERIFIED_OFFICIAL',20,'INTERNATIONAL','PERMITTED_API','Official OCDS feed under the Open Government Licence 3.0.','API','https://www.contractsfinder.service.gov.uk/apidocumentation','Ghanaian eligibility is never inferred.','{"standard":"OCDS 1.1"}'::jsonb),
('UK Find a Tender','uk-find-a-tender','UK Cabinet Office','https://www.find-tender.service.gov.uk/','GB','OPEN_API','LIVE',true,false,null,'https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages',true,'6 hours','ACTIVE','VERIFIED_OFFICIAL',20,'INTERNATIONAL','PERMITTED_API','Official OCDS feed under the Open Government Licence 3.0.','API','https://www.find-tender.service.gov.uk/Developer/Documentation','Ghanaian eligibility is never inferred.','{"standard":"OCDS 1.1.5"}'::jsonb),
('UNGM','ungm','United Nations Global Marketplace','https://www.ungm.org/Public/Notice','ZZ','API','AUTHORIZATION_REQUIRED',false,true,'UNGM_CLIENT_SECRET','https://www.ungm.org/Shared/KnowledgeCenter/Pages/API',false,'6 hours','PAUSED','VERIFIED_OFFICIAL',10,'INTERNATIONAL','AUTHORIZATION_REQUIRED','OAuth 2.0 developer credentials are required.','API','https://developer.ungm.org/','No live fetch until credentials and authorization are configured.','{}'::jsonb),
('SAM.gov','sam-gov','U.S. General Services Administration','https://sam.gov/content/opportunities','US','API','API_KEY_REQUIRED',false,true,'SAM_GOV_API_KEY','https://api.sam.gov/opportunities/v2/search',false,'6 hours','PAUSED','VERIFIED_OFFICIAL',10,'INTERNATIONAL','API_KEY_REQUIRED','Official Get Opportunities API requires an API key.','API','https://open.gsa.gov/api/get-opportunities-public-api/','No live fetch until a server-side API key is configured.','{}'::jsonb),
('African Development Bank','afdb','African Development Bank Group','https://www.afdb.org/en/projects-and-operations/procurement','ZZ','RSS','RESEARCH_REQUIRED',false,false,null,null,false,'12 hours','UNAVAILABLE','VERIFIED_OFFICIAL',5,'INTERNATIONAL','RESEARCH_REQUIRED','Official site advertises RSS, but the exact stable feed was not technically verified.','UNKNOWN','https://www.afdb.org/en/rss-feeds','Cloudflare currently prevents a dependable server-side fetch; not marked live.','{}'::jsonb)
on conflict(slug) do update set name=excluded.name,organisation=excluded.organisation,base_url=excluded.base_url,country_code=excluded.country_code,integration_type=excluded.integration_type,implementation_status=excluded.implementation_status,api_enabled=excluded.api_enabled,api_key_required=excluded.api_key_required,environment_key_name=excluded.environment_key_name,endpoint_url=excluded.endpoint_url,sync_enabled=excluded.sync_enabled,sync_frequency=excluded.sync_frequency,status=excluded.status,trust_level=excluded.trust_level,rate_limit_per_minute=excluded.rate_limit_per_minute,source_scope=excluded.source_scope,access_classification=excluded.access_classification,reuse_basis=excluded.reuse_basis,robots_status=excluded.robots_status,terms_url=excluded.terms_url,coverage_notes=excluded.coverage_notes,configuration=excluded.configuration;

create or replace function public.refresh_procurement_opportunity_statuses()
returns integer language plpgsql security definer set search_path=public as $$
declare affected integer;
begin
  update public.procurement_opportunities set status = case
    when notice_stage in ('FORECAST','PLANNED') then 'UPCOMING'
    when deadline_at < now() then 'CLOSED'
    when deadline_at <= now() + interval '7 days' then 'CLOSING_SOON'
    when deadline_at > now() then 'OPEN'
    else 'UNKNOWN' end
  where status not in ('AWARDED','CANCELLED','DRAFT','ARCHIVED');
  get diagnostics affected=row_count; return affected;
end; $$;
revoke execute on function public.refresh_procurement_opportunity_statuses() from public,anon,authenticated;
grant execute on function public.refresh_procurement_opportunity_statuses() to service_role;
