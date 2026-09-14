-- Extend the existing customer command centre with persistent, explainable retention intelligence.
alter table public.organizations
  add column if not exists business_description text,
  add column if not exists annual_turnover_min numeric,
  add column if not exists annual_turnover_max numeric,
  add column if not exists turnover_currency text,
  add column if not exists preferred_countries text[] not null default '{}',
  add column if not exists preferred_buyers text[] not null default '{}',
  add column if not exists excluded_buyers text[] not null default '{}',
  add column if not exists preferred_opportunity_types text[] not null default '{}',
  add column if not exists international_willingness boolean,
  add column if not exists local_partnership_willingness boolean,
  add column if not exists cpv_codes text[] not null default '{}',
  add column if not exists unspsc_codes text[] not null default '{}',
  add column if not exists best_match_opportunity_id uuid references public.procurement_opportunities(id) on delete set null,
  add column if not exists best_match_score integer check (best_match_score between 0 and 100),
  add column if not exists best_match_reason text,
  add column if not exists best_match_at timestamptz;

alter table public.customer_preferences
  add column if not exists last_login_at timestamptz,
  add column if not exists last_feed_view_at timestamptz,
  add column if not exists last_opportunity_seen_at timestamptz;

alter table public.customer_saved_searches
  add column if not exists frequency text not null default 'daily'
    check (frequency in ('instant','daily','weekly'));

alter table public.watched_entities
  add column if not exists relevant_only boolean not null default true;

alter table public.opportunity_revisions
  add column if not exists severity text not null default 'medium'
    check (severity in ('low','medium','high','critical')),
  add column if not exists change_types text[] not null default '{}';

create table if not exists public.organization_opportunity_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  opportunity_id uuid not null references public.procurement_opportunities(id) on delete cascade,
  business_match_score integer check (business_match_score between 0 and 100),
  eligibility_score integer check (eligibility_score between 0 and 100),
  capability_score integer check (capability_score between 0 and 100),
  financial_fit_score integer check (financial_fit_score between 0 and 100),
  experience_fit_score integer check (experience_fit_score between 0 and 100),
  document_readiness_score integer check (document_readiness_score between 0 and 100),
  deadline_feasibility_score integer check (deadline_feasibility_score between 0 and 100),
  overall_score integer check (overall_score between 0 and 100),
  decision text not null check (decision in ('STRONG_GO','GO','REVIEW','HIGH_RISK','NO_GO','UNKNOWN')),
  reasons jsonb not null default '[]',
  concerns jsonb not null default '[]',
  evidence jsonb not null default '{}',
  evidence_hash text not null,
  calculated_at timestamptz not null default now(),
  unique (organization_id, opportunity_id)
);
create index if not exists organization_matches_rank_idx on public.organization_opportunity_matches(organization_id, overall_score desc nulls last, calculated_at desc);
create index if not exists opportunity_matches_opportunity_idx on public.organization_opportunity_matches(opportunity_id, calculated_at desc);

create table if not exists public.opportunity_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  opportunity_id uuid not null references public.procurement_opportunities(id) on delete cascade,
  action text not null check (action in ('hidden','not_relevant')),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, opportunity_id)
);

create table if not exists public.bid_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  opportunity_id uuid not null references public.procurement_opportunities(id) on delete cascade,
  overall_score integer check (overall_score between 0 and 100),
  decision text not null check (decision in ('STRONG_GO','GO','REVIEW','HIGH_RISK','NO_GO','UNKNOWN')),
  component_scores jsonb not null default '{}',
  reasons jsonb not null default '[]',
  concerns jsonb not null default '[]',
  evidence jsonb not null default '{}',
  calculated_at timestamptz not null default now(),
  unique (user_id, opportunity_id)
);

create table if not exists public.business_readiness_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  overall_score integer not null check (overall_score between 0 and 100),
  confidence text not null check (confidence in ('low','medium','high')),
  category_scores jsonb not null default '{}',
  recommendations jsonb not null default '[]',
  evidence jsonb not null default '{}',
  evidence_hash text not null,
  calculated_at timestamptz not null default now(),
  is_current boolean not null default true
);
create unique index if not exists business_readiness_current_idx on public.business_readiness_scores(organization_id) where is_current;

create table if not exists public.procurement_radar_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  opportunity_id uuid references public.procurement_opportunities(id) on delete cascade,
  buyer_id uuid references public.procuring_entities(id) on delete set null,
  buyer_name text,
  signal_type text not null check (signal_type in ('OFFICIAL_UPCOMING','LIKELY_REPEAT','BUYER_ACTIVITY','SECTOR_ACTIVITY')),
  title text not null,
  summary text not null default '',
  confidence text not null check (confidence in ('low','medium','high','official')),
  evidence jsonb not null default '{}',
  source_url text,
  expected_at timestamptz,
  status text not null default 'active' check (status in ('active','expired','dismissed')),
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, dedupe_key)
);
create index if not exists procurement_radar_org_idx on public.procurement_radar_items(organization_id, status, expected_at);

alter table public.organization_opportunity_matches enable row level security;
alter table public.opportunity_feedback enable row level security;
alter table public.bid_decisions enable row level security;
alter table public.business_readiness_scores enable row level security;
alter table public.procurement_radar_items enable row level security;

create policy organization_matches_member_read on public.organization_opportunity_matches for select to authenticated using (public.is_organization_member(organization_id));
create policy opportunity_feedback_owner_all on public.opportunity_feedback for all to authenticated using (user_id=auth.uid() and public.is_organization_member(organization_id)) with check (user_id=auth.uid() and public.is_organization_member(organization_id));
create policy bid_decisions_owner_all on public.bid_decisions for all to authenticated using (user_id=auth.uid() and public.is_organization_member(organization_id)) with check (user_id=auth.uid() and public.is_organization_member(organization_id));
create policy readiness_member_read on public.business_readiness_scores for select to authenticated using (public.is_organization_member(organization_id));
create policy radar_member_read on public.procurement_radar_items for select to authenticated using (public.is_organization_member(organization_id));

revoke all on public.organization_opportunity_matches, public.opportunity_feedback, public.bid_decisions, public.business_readiness_scores, public.procurement_radar_items from anon;
grant select on public.organization_opportunity_matches, public.business_readiness_scores, public.procurement_radar_items to authenticated;
grant select,insert,update,delete on public.opportunity_feedback, public.bid_decisions to authenticated;
grant all on public.organization_opportunity_matches, public.opportunity_feedback, public.bid_decisions, public.business_readiness_scores, public.procurement_radar_items to service_role;

drop trigger if exists opportunity_feedback_set_updated_at on public.opportunity_feedback;
create trigger opportunity_feedback_set_updated_at before update on public.opportunity_feedback for each row execute function public.set_updated_at();
drop trigger if exists procurement_radar_set_updated_at on public.procurement_radar_items;
create trigger procurement_radar_set_updated_at before update on public.procurement_radar_items for each row execute function public.set_updated_at();

-- Hidden/not-relevant feedback is honoured by the existing discovery function.
create or replace function public.customer_discover(p_user uuid, filters jsonb default '{}', page_number integer default 1, page_size integer default 20) returns jsonb
language sql stable set search_path=public as $$
with profile as (
 select to_jsonb(o) data from organizations o join organization_members m on m.organization_id=o.id where m.user_id=p_user order by m.created_at limit 1
), base as (
 select o.*, public.customer_match(coalesce((select data from profile),'{}'),to_jsonb(o)) match,
 exists(select 1 from saved_opportunities s join organization_members m on m.organization_id=s.organization_id where m.user_id=p_user and s.opportunity_id=o.id) saved,
 (select r.viewed_at from customer_recent_opportunities r where r.user_id=p_user and r.opportunity_id=o.id) viewed_at
 from procurement_opportunities o
 where o.published_at is not null and o.source_removed_at is null
 and not exists(select 1 from opportunity_feedback f where f.user_id=p_user and f.opportunity_id=o.id and f.action in ('hidden','not_relevant'))
 and (case when filters->>'stage'='upcoming' then o.status='UPCOMING' when filters->>'collection' in ('saved','recent') then o.status<>'DRAFT' else o.status in ('OPEN','CLOSING_SOON') and (o.deadline_at is null or o.deadline_at>now()) end)
 and (coalesce(filters->>'scope','all')='all' or (filters->>'scope'='ghana' and o.country_code='GH') or (filters->>'scope'='international' and o.country_code<>'GH'))
 and (coalesce(filters->>'q','')='' or o.search_document @@ websearch_to_tsquery('english',filters->>'q') or o.external_reference ilike '%'||(filters->>'q')||'%' or o.country ilike '%'||(filters->>'q')||'%')
 and (coalesce(filters->>'country','')='' or o.country ilike '%'||(filters->>'country')||'%' or o.country_code=upper(filters->>'country'))
 and (coalesce(filters->>'sector','')='' or o.sector ilike '%'||(filters->>'sector')||'%')
 and (coalesce(filters->>'buyer','')='' or o.buyer_name ilike '%'||(filters->>'buyer')||'%')
 and (coalesce(filters->>'source','')='' or o.source_name ilike '%'||(filters->>'source')||'%')
 and (coalesce(filters->>'region','')='' or o.region ilike '%'||(filters->>'region')||'%')
 and (coalesce(filters->>'category','')='' or o.category ilike '%'||(filters->>'category')||'%')
 and (coalesce(filters->>'contractType','')='' or o.contract_type ilike '%'||(filters->>'contractType')||'%')
 and (coalesce(filters->>'procurementMethod','')='' or o.procurement_method ilike '%'||(filters->>'procurementMethod')||'%')
 and (coalesce(filters->>'funding','')='' or concat_ws(' ',o.funding_source,o.funding_agency) ilike '%'||(filters->>'funding')||'%')
 and (coalesce(filters->>'currency','')='' or o.currency=upper(filters->>'currency'))
 and (coalesce(filters->>'eligibility','')='' or o.eligibility_status=filters->>'eligibility')
 and (nullif(filters->>'minimumValue','') is null or o.estimated_value >= (filters->>'minimumValue')::numeric)
 and (nullif(filters->>'maximumValue','') is null or o.estimated_value <= (filters->>'maximumValue')::numeric)
 and (nullif(filters->>'deadlineBefore','') is null or o.deadline_at <= (filters->>'deadlineBefore')::date + interval '1 day')
 and (nullif(filters->>'publishedAfter','') is null or o.published_at >= (filters->>'publishedAfter')::timestamptz)
 and (nullif(filters->>'days','') is null or o.deadline_at <= now()+make_interval(days=>(filters->>'days')::integer))
), filtered as (
 select * from base where (coalesce(filters->>'collection','')<>'saved' or saved)
 and (coalesce(filters->>'collection','')<>'recent' or viewed_at is not null)
 and (coalesce(filters->>'collection','')<>'recommended' or (match->>'percentage')::integer>0)
 and (nullif(filters->>'match','') is null or (match->>'percentage')::integer >= (filters->>'match')::integer)
), results as (
 select to_jsonb(f)-'raw_payload'-'search_document' data from filtered f
 order by case when filters->>'collection'='recent' then viewed_at end desc nulls last,
 case when filters->>'sort'='match' or filters->>'collection'='recommended' then (match->>'percentage')::integer end desc nulls last,
 case when filters->>'sort'='newest' then published_at end desc nulls last,
 deadline_at asc nulls last, id
 limit least(greatest(page_size,1),50) offset (greatest(page_number,1)-1)*least(greatest(page_size,1),50)
) select jsonb_build_object('data',coalesce((select jsonb_agg(data) from results),'[]'),'pagination',jsonb_build_object('total',(select count(*) from filtered),'page',greatest(page_number,1),'pageSize',least(greatest(page_size,1),50)))
$$;
revoke all on function public.customer_discover(uuid,jsonb,integer,integer) from public,anon,authenticated;
grant execute on function public.customer_discover(uuid,jsonb,integer,integer) to service_role;
