-- Discovery is private staging. Existing procurement_opportunities remains the only published feed.
alter table public.procurement_sources
  add column if not exists discovery_enabled boolean not null default false,
  add column if not exists discovery_source_type text,
  add column if not exists crawl_start_url text,
  add column if not exists crawl_include_patterns text[] not null default '{}',
  add column if not exists crawl_exclude_patterns text[] not null default '{}',
  add column if not exists crawl_max_pages integer not null default 2 check (crawl_max_pages between 1 and 100),
  add column if not exists crawl_depth integer not null default 1 check (crawl_depth between 0 and 3),
  add column if not exists crawl_interval_hours integer not null default 24 check (crawl_interval_hours between 1 and 720),
  add column if not exists crawl_requires_rendering boolean not null default false,
  add column if not exists crawl_robots_allowed boolean not null default false,
  add column if not exists crawl_terms_reviewed boolean not null default false,
  add column if not exists crawl_next_at timestamptz,
  add column if not exists crawl_last_at timestamptz,
  add column if not exists crawl_last_success_at timestamptz,
  add column if not exists crawl_last_failure_at timestamptz,
  add column if not exists crawl_consecutive_failures integer not null default 0;

create index if not exists procurement_sources_discovery_due_idx
  on public.procurement_sources(crawl_next_at) where discovery_enabled;

create table if not exists public.discovery_settings (
  singleton_key text primary key default 'default' check (singleton_key = 'default'),
  enabled boolean not null default false,
  auto_publish boolean not null default false,
  max_crawls_per_day integer not null default 4 check (max_crawls_per_day between 0 and 1000),
  max_rendered_pages_per_day integer not null default 0 check (max_rendered_pages_per_day between 0 and 10000),
  max_extractions_per_day integer not null default 40 check (max_extractions_per_day between 0 and 100000),
  max_concurrent_jobs integer not null default 1 check (max_concurrent_jobs between 1 and 100),
  updated_at timestamptz not null default now()
);
insert into public.discovery_settings(singleton_key) values ('default') on conflict do nothing;

create table if not exists public.discovery_crawl_jobs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.procurement_sources(id) on delete cascade,
  cloudflare_job_id text unique,
  status text not null default 'reserved' check (status in ('reserved','running','completed','failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  pages_examined integer not null default 0,
  discoveries_found integer not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);
create index if not exists discovery_crawl_jobs_source_started_idx on public.discovery_crawl_jobs(source_id,started_at desc);
create index if not exists discovery_crawl_jobs_status_idx on public.discovery_crawl_jobs(status,started_at);

create table if not exists public.opportunity_discoveries (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.procurement_sources(id) on delete cascade,
  crawl_job_id uuid references public.discovery_crawl_jobs(id) on delete set null,
  source_url text not null,
  canonical_url text not null,
  source_reference text,
  content_hash text not null,
  raw_title text,
  raw_text text not null default '',
  raw_metadata jsonb not null default '{}'::jsonb,
  extracted_data jsonb not null default '{}'::jsonb,
  extracted_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  processing_status text not null default 'discovered' check (processing_status in ('discovered','needs_review','approved','published','rejected','expired','error')),
  duplicate_status text not null default 'unique' check (duplicate_status in ('unique','exact_duplicate','probable_duplicate','possible_duplicate','manually_confirmed_unique','manually_confirmed_duplicate')),
  matched_tender_id uuid references public.procurement_opportunities(id) on delete set null,
  confidence_score numeric(4,3) not null default 0 check (confidence_score between 0 and 1),
  duplicate_score numeric(4,3) not null default 0 check (duplicate_score between 0 and 1),
  error_message text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id,canonical_url)
);
create index if not exists opportunity_discoveries_review_idx on public.opportunity_discoveries(processing_status,created_at desc);
create index if not exists opportunity_discoveries_reference_idx on public.opportunity_discoveries(source_reference) where source_reference is not null;
create index if not exists opportunity_discoveries_hash_idx on public.opportunity_discoveries(source_id,content_hash);
create index if not exists opportunity_discoveries_extracted_idx on public.opportunity_discoveries(extracted_at) where extracted_at is not null;
create index if not exists opportunity_discoveries_match_idx on public.opportunity_discoveries(matched_tender_id) where matched_tender_id is not null;

alter table public.discovery_settings enable row level security;
alter table public.discovery_crawl_jobs enable row level security;
alter table public.opportunity_discoveries enable row level security;
revoke all on public.discovery_settings, public.discovery_crawl_jobs, public.opportunity_discoveries from anon, authenticated;
grant all on public.discovery_settings, public.discovery_crawl_jobs, public.opportunity_discoveries to service_role;
grant select on public.discovery_settings, public.discovery_crawl_jobs, public.opportunity_discoveries to authenticated;
drop policy if exists discovery_settings_admin_select on public.discovery_settings;
drop policy if exists discovery_jobs_admin_select on public.discovery_crawl_jobs;
drop policy if exists discoveries_admin_select on public.opportunity_discoveries;
create policy discovery_settings_admin_select on public.discovery_settings for select to authenticated using (public.is_super_admin());
create policy discovery_jobs_admin_select on public.discovery_crawl_jobs for select to authenticated using (public.is_super_admin());
create policy discoveries_admin_select on public.opportunity_discoveries for select to authenticated using (public.is_super_admin());

-- Transactional claim prevents parallel cron/manual requests from starting duplicate jobs.
create or replace function public.claim_discovery_crawl(p_source_id uuid default null)
returns table(job_id uuid, source_id uuid)
language plpgsql security definer set search_path = public
as $$
declare selected_source uuid;
declare selected_job uuid;
declare cfg public.discovery_settings%rowtype;
begin
  perform pg_advisory_xact_lock(84721900);
  select * into cfg from public.discovery_settings where singleton_key = 'default';
  if not cfg.enabled then return; end if;
  if (select count(*) from public.discovery_crawl_jobs where started_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc') >= cfg.max_crawls_per_day then return; end if;
  if (select count(*) from public.discovery_crawl_jobs where status in ('reserved','running')) >= cfg.max_concurrent_jobs then return; end if;
  select s.id into selected_source from public.procurement_sources s
    where s.discovery_enabled and s.crawl_robots_allowed and s.crawl_terms_reviewed
      and (p_source_id is null or s.id = p_source_id)
      and (not s.crawl_requires_rendering or (
        cfg.max_rendered_pages_per_day >= s.crawl_max_pages and
        coalesce((select sum(rs.crawl_max_pages) from public.discovery_crawl_jobs j
          join public.procurement_sources rs on rs.id = j.source_id
          where j.started_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'
          and rs.crawl_requires_rendering), 0) + s.crawl_max_pages <= cfg.max_rendered_pages_per_day
      ))
      and s.crawl_consecutive_failures < 5
      and (p_source_id is not null or s.crawl_next_at is null or s.crawl_next_at <= now())
    order by s.crawl_next_at nulls first, s.id limit 1 for update skip locked;
  if selected_source is null then return; end if;
  update public.procurement_sources set crawl_next_at = now() + make_interval(hours => crawl_interval_hours), crawl_last_at = now(), updated_at = now() where id = selected_source;
  insert into public.discovery_crawl_jobs(source_id) values (selected_source) returning id into selected_job;
  return query select selected_job, selected_source;
end;
$$;
revoke execute on function public.claim_discovery_crawl(uuid) from public, anon, authenticated;
grant execute on function public.claim_discovery_crawl(uuid) to service_role;
