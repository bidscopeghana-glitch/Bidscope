-- BidScope Phase 2: protected SEO growth, attribution and editorial operations.
-- Public pages never receive direct access to these tables. Browser events are
-- validated by a server route and inserted with the service credential.

create table if not exists public.seo_settings (
  singleton_key text primary key default 'default' check (singleton_key = 'default'),
  site_url text not null default 'https://www.bidscopeghana.com',
  search_console_property text not null default 'sc-domain:bidscopeghana.com',
  search_console_connected boolean not null default false,
  analytics_measurement_id text,
  reporting_email text,
  weekly_report_enabled boolean not null default true,
  monthly_report_enabled boolean not null default true,
  stale_content_days integer not null default 120 check (stale_content_days between 30 and 730),
  minimum_indexable_tenders integer not null default 3 check (minimum_indexable_tenders between 1 and 100),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.seo_settings(singleton_key) values ('default') on conflict do nothing;

create table if not exists public.seo_keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  normalized_keyword text generated always as (lower(trim(keyword))) stored,
  cluster text not null default 'Unassigned',
  target_url text,
  country_code text not null default 'GH' check (char_length(country_code)=2),
  intent text not null default 'commercial' check (intent in ('informational','commercial','transactional','navigational')),
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status text not null default 'tracking' check (status in ('idea','tracking','won','paused')),
  current_position numeric(7,2),
  previous_position numeric(7,2),
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  ctr numeric(8,5),
  opportunity_score numeric(6,2) not null default 0,
  last_checked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(normalized_keyword,country_code)
);

create table if not exists public.seo_keyword_history (
  id bigint generated always as identity primary key,
  keyword_id uuid not null references public.seo_keywords(id) on delete cascade,
  recorded_on date not null default current_date,
  position numeric(7,2),
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  ctr numeric(8,5),
  source text not null default 'manual' check (source in ('manual','search_console')),
  unique(keyword_id,recorded_on)
);

create table if not exists public.seo_content_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  content_type text not null default 'article' check (content_type in ('article','guide','landing_page','comparison','case_study')),
  cluster text not null default 'Procurement intelligence',
  primary_keyword text,
  secondary_keywords text[] not null default '{}',
  search_intent text not null default 'informational',
  target_audience text not null default 'Ghanaian suppliers',
  status text not null default 'idea' check (status in ('idea','brief','draft','review','scheduled','published','refresh_due','archived')),
  owner_name text,
  outline jsonb not null default '[]'::jsonb,
  recommended_internal_links text[] not null default '{}',
  planned_for date,
  published_at timestamptz,
  last_reviewed_at timestamptz,
  word_count integer not null default 0,
  quality_score integer not null default 0 check (quality_score between 0 and 100),
  freshness_score integer not null default 100 check (freshness_score between 0 and 100),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seo_page_metrics (
  id bigint generated always as identity primary key,
  page_url text not null,
  metric_date date not null default current_date,
  page_type text not null default 'other',
  clicks bigint not null default 0,
  impressions bigint not null default 0,
  ctr numeric(8,5),
  average_position numeric(7,2),
  organic_sessions bigint not null default 0,
  signups bigint not null default 0,
  subscriptions bigint not null default 0,
  revenue_minor bigint not null default 0,
  currency text not null default 'GHS',
  engagement_seconds integer not null default 0,
  source text not null default 'internal',
  created_at timestamptz not null default now(),
  unique(page_url,metric_date,source)
);

create table if not exists public.seo_traffic_sessions (
  id uuid primary key default gen_random_uuid(),
  visitor_id_hash text not null,
  session_id text not null unique,
  landing_path text not null,
  referrer_host text,
  first_source text,
  first_medium text,
  first_campaign text,
  last_source text,
  last_medium text,
  last_campaign text,
  device_type text,
  consented boolean not null default false,
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.seo_conversion_events (
  id bigint generated always as identity primary key,
  session_id text references public.seo_traffic_sessions(session_id) on delete set null,
  event_name text not null check (event_name in ('sign_up','sign_in','tender_view','alert_created','subscription_started','subscription_paid','service_request','official_source_opened')),
  page_path text,
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  opportunity_id uuid references public.procurement_opportunities(id) on delete set null,
  value_minor bigint,
  currency text not null default 'GHS',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.seo_backlinks (
  id uuid primary key default gen_random_uuid(),
  source_url text not null,
  target_url text not null,
  source_domain text,
  anchor_text text,
  status text not null default 'prospect' check (status in ('prospect','contacted','live','lost','declined')),
  relationship_owner text,
  contact_email text,
  next_action_at timestamptz,
  first_seen_at timestamptz,
  last_checked_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_url,target_url)
);

create table if not exists public.seo_experiments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  page_url text not null,
  hypothesis text not null,
  variant_a jsonb not null default '{}'::jsonb,
  variant_b jsonb not null default '{}'::jsonb,
  primary_metric text not null default 'organic_conversion_rate',
  status text not null default 'draft' check (status in ('draft','running','paused','completed','cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  result jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seo_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  title text not null,
  message text not null,
  related_url text,
  metadata jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create table if not exists public.seo_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('search_console','analytics','internal_audit')),
  status text not null default 'running' check (status in ('running','succeeded','partial','failed','owner_action_required')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  rows_processed integer not null default 0,
  error_summary text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists seo_keywords_priority_idx on public.seo_keywords(status,priority,opportunity_score desc);
create index if not exists seo_content_status_idx on public.seo_content_items(status,planned_for);
create index if not exists seo_page_metrics_date_idx on public.seo_page_metrics(metric_date desc,page_type);
create index if not exists seo_traffic_first_seen_idx on public.seo_traffic_sessions(first_seen_at desc,first_source);
create index if not exists seo_conversion_created_idx on public.seo_conversion_events(created_at desc,event_name);
create index if not exists seo_alerts_open_idx on public.seo_alerts(severity,detected_at desc) where resolved_at is null;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'seo_settings','seo_keywords','seo_keyword_history','seo_content_items','seo_page_metrics',
    'seo_traffic_sessions','seo_conversion_events','seo_backlinks','seo_experiments','seo_alerts','seo_sync_runs'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists seo_super_admin_all on public.%I', table_name);
    execute format('create policy seo_super_admin_all on public.%I for all to authenticated using ((select public.is_super_admin())) with check ((select public.is_super_admin()))', table_name);
    execute format('grant all on public.%I to service_role', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  end loop;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array['seo_settings','seo_keywords','seo_content_items','seo_backlinks','seo_experiments'] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

