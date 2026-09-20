-- BidScope Phase 2 completion: operational SEO reporting, demand intelligence,
-- ethical outreach, UTM governance and a review-first editorial workflow.

alter table public.seo_settings
  add column if not exists google_verification_configured boolean not null default false,
  add column if not exists search_console_last_synced_at timestamptz,
  add column if not exists default_report_range_days integer not null default 28
    check (default_report_range_days in (7,28,90,180,365));

alter table public.seo_content_items
  add column if not exists excerpt text,
  add column if not exists body text,
  add column if not exists seo_title text,
  add column if not exists meta_description text,
  add column if not exists canonical_url text,
  add column if not exists featured_image_url text,
  add column if not exists author_name text,
  add column if not exists author_role text,
  add column if not exists author_bio text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists related_tender_categories text[] not null default '{}',
  add column if not exists cta_type text not null default 'find_opportunities',
  add column if not exists indexable boolean not null default false,
  add column if not exists scheduled_for timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists quality_warnings jsonb not null default '[]'::jsonb;

alter table public.seo_page_metrics
  add column if not exists buyer_registrations bigint not null default 0,
  add column if not exists supplier_registrations bigint not null default 0,
  add column if not exists tender_watches bigint not null default 0,
  add column if not exists bids_started bigint not null default 0,
  add column if not exists bids_submitted bigint not null default 0,
  add column if not exists tender_posts bigint not null default 0,
  add column if not exists assisted_conversions bigint not null default 0;

alter table public.seo_conversion_events drop constraint if exists seo_conversion_events_event_name_check;
alter table public.seo_conversion_events add constraint seo_conversion_events_event_name_check check (event_name in (
  'sign_up','sign_in','supplier_signup','buyer_signup','tender_view','tender_watch',
  'alert_created','tender_alert_created','subscription_click','subscription_started',
  'subscription_completed','subscription_paid','bid_started','bid_submitted',
  'tender_post_started','tender_post_completed','related_tender_click',
  'protected_details_click','service_request','official_source_opened'
));

create table if not exists public.seo_internal_searches (
  id bigint generated always as identity primary key,
  searched_on date not null default current_date,
  query text not null,
  normalized_query text generated always as (lower(trim(query))) stored,
  result_count integer not null default 0,
  searches bigint not null default 1,
  tender_watches bigint not null default 0,
  subscriptions bigint not null default 0,
  last_seen_at timestamptz not null default now(),
  unique(searched_on,normalized_query)
);

create table if not exists public.seo_search_synonyms (
  id uuid primary key default gen_random_uuid(),
  canonical_term text not null,
  synonyms text[] not null default '{}',
  enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(canonical_term)
);

create table if not exists public.seo_referral_metrics (
  id bigint generated always as identity primary key,
  metric_date date not null default current_date,
  referring_domain text not null,
  sessions bigint not null default 0,
  signups bigint not null default 0,
  subscriptions bigint not null default 0,
  tender_watches bigint not null default 0,
  bids bigint not null default 0,
  revenue_minor bigint not null default 0,
  unique(metric_date,referring_domain)
);

create table if not exists public.seo_search_dimensions (
  id bigint generated always as identity primary key,
  metric_date date not null,
  dimension_type text not null check (dimension_type in ('country','device','search_appearance','query_page')),
  dimension_value text not null,
  secondary_value text not null default '',
  clicks bigint not null default 0,
  impressions bigint not null default 0,
  ctr numeric(8,5),
  average_position numeric(7,2),
  unique(metric_date,dimension_type,dimension_value,secondary_value)
);

create table if not exists public.seo_outreach_targets (
  id uuid primary key default gen_random_uuid(),
  organisation text not null,
  website text,
  target_type text not null default 'business_directory',
  contact_name text,
  contact_email text,
  reason_to_approach text,
  target_url text,
  status text not null default 'discovered' check (status in ('discovered','outreach_planned','contacted','interested','link_live','declined','removed')),
  last_contact_at timestamptz,
  next_follow_up_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seo_utm_links (
  id uuid primary key default gen_random_uuid(),
  destination_url text not null,
  source text not null,
  medium text not null,
  campaign text not null,
  content text,
  term text,
  generated_url text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.seo_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null check (report_type in ('weekly','monthly')),
  period_start date not null,
  period_end date not null,
  status text not null default 'ready' check (status in ('generating','ready','failed')),
  summary jsonb not null default '{}'::jsonb,
  generated_by uuid references auth.users(id) on delete set null,
  generated_at timestamptz not null default now(),
  unique(report_type,period_start,period_end)
);

create table if not exists public.seo_technical_checks (
  id bigint generated always as identity primary key,
  checked_at timestamptz not null default now(),
  check_key text not null,
  status text not null check (status in ('pass','warning','critical','owner_action_required')),
  affected_count integer not null default 0,
  message text not null,
  details jsonb not null default '{}'::jsonb
);

create table if not exists public.seo_social_drafts (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid references public.seo_content_items(id) on delete cascade,
  destination_url text not null,
  linkedin_copy text,
  facebook_copy text,
  whatsapp_copy text,
  x_copy text,
  status text not null default 'draft' check (status in ('draft','approved','archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists seo_internal_searches_demand_idx on public.seo_internal_searches(searches desc,result_count);
create index if not exists seo_referral_metrics_domain_idx on public.seo_referral_metrics(referring_domain,metric_date desc);
create index if not exists seo_search_dimensions_date_idx on public.seo_search_dimensions(metric_date desc,dimension_type);
create index if not exists seo_outreach_status_idx on public.seo_outreach_targets(status,next_follow_up_at);
create index if not exists seo_reports_period_idx on public.seo_reports(report_type,period_end desc);
create index if not exists seo_technical_checks_time_idx on public.seo_technical_checks(checked_at desc,check_key);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'seo_internal_searches','seo_search_synonyms','seo_referral_metrics','seo_search_dimensions','seo_outreach_targets',
    'seo_utm_links','seo_reports','seo_technical_checks','seo_social_drafts'
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
  foreach table_name in array array['seo_search_synonyms','seo_outreach_targets','seo_social_drafts'] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

insert into public.seo_search_synonyms(canonical_term,synonyms) values
  ('ICT',array['IT','technology','software','digital']),
  ('construction',array['building','civil works','infrastructure']),
  ('logistics',array['transport','haulage','freight']),
  ('RFQ',array['request for quotation','quotation request']),
  ('RFP',array['request for proposal','proposal request'])
on conflict (canonical_term) do nothing;
