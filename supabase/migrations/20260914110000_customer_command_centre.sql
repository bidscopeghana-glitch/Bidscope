-- Customer-owned preferences, preparation records and scalable discovery.
create table public.customer_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}', last_visit_at timestamptz,
  previous_visit_at timestamptz, updated_at timestamptz not null default now()
);
create table public.customer_recent_opportunities (
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null references public.procurement_opportunities(id) on delete cascade,
  viewed_at timestamptz not null default now(), primary key(user_id, opportunity_id)
);
create table public.customer_saved_searches (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(length(name) between 1 and 160), filters jsonb not null default '{}',
  alerts_enabled boolean not null default false, last_notified_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.customer_bid_preparation (
  bid_id uuid primary key references public.user_bid_tracking(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  checklist jsonb not null default '[]', questions text not null default '',
  requirements text not null default '', team text not null default '',
  documents jsonb not null default '[]', deadlines jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
create index customer_recent_viewed_idx on public.customer_recent_opportunities(user_id, viewed_at desc);
create index customer_search_user_idx on public.customer_saved_searches(user_id, created_at desc);
alter table public.customer_preferences enable row level security;
alter table public.customer_recent_opportunities enable row level security;
alter table public.customer_saved_searches enable row level security;
alter table public.customer_bid_preparation enable row level security;
create policy customer_preferences_self on public.customer_preferences for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy customer_recent_self on public.customer_recent_opportunities for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy customer_searches_self on public.customer_saved_searches for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy customer_preparation_self on public.customer_bid_preparation for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and exists(select 1 from public.user_bid_tracking b where b.id=bid_id and b.user_id=auth.uid()));
grant select,insert,update,delete on public.customer_preferences,public.customer_recent_opportunities,public.customer_saved_searches,public.customer_bid_preparation to authenticated;
grant all on public.customer_preferences,public.customer_recent_opportunities,public.customer_saved_searches,public.customer_bid_preparation to service_role;

-- Same weighted, evidence-based rules as calculateOpportunityMatch, executed
-- inside Postgres so sorting and pagination apply to the full result set.
create function public.customer_match(profile jsonb, opportunity jsonb) returns jsonb
language plpgsql immutable set search_path=public as $$
declare terms text[]; regions text[]; earned numeric=0; possible numeric=0; reasons jsonb='[]'; hay text;
begin
  profile=jsonb_strip_nulls(profile);
  select array_agg(lower(value)) into terms from jsonb_array_elements_text(coalesce(profile->'sectors','[]')||coalesce(profile->'services','[]')||coalesce(profile->'products','[]')) where trim(value)<>'';
  hay=lower(concat_ws(' ',opportunity->>'title',opportunity->>'summary',opportunity->>'sector',opportunity->>'category'));
  if cardinality(terms)>0 then
    possible=possible+50;
    if exists(select 1 from unnest(terms) t where strpos(hay,t)>0) then earned=earned+50; reasons=reasons||'"Category or service matches your company profile"'::jsonb; end if;
  end if;
  select array_agg(lower(value)) into regions from jsonb_array_elements_text(case when jsonb_array_length(coalesce(profile->'preferred_regions','[]'))>0 then profile->'preferred_regions' else jsonb_build_array(coalesce(profile->>'region','')) end) where trim(value)<>'';
  if cardinality(regions)>0 and nullif(opportunity->>'region','') is not null then
    possible=possible+20;
    if lower(opportunity->>'region')=any(regions) then earned=earned+20; reasons=reasons||'"Region matches your preferred coverage"'::jsonb; end if;
  end if;
  if (profile->>'preferred_minimum_value' is not null or profile->>'preferred_maximum_value' is not null) and opportunity->>'estimated_value' is not null then
    possible=possible+30;
    if (profile->>'preferred_minimum_value' is null or (opportunity->>'estimated_value')::numeric >= (profile->>'preferred_minimum_value')::numeric) and (profile->>'preferred_maximum_value' is null or (opportunity->>'estimated_value')::numeric <= (profile->>'preferred_maximum_value')::numeric) then earned=earned+30; reasons=reasons||'"Estimated value matches your preferred range"'::jsonb; end if;
  end if;
  if jsonb_array_length(coalesce(profile->'certifications','[]'))>0 and nullif(opportunity->>'eligibility_text','') is not null then
    possible=possible+15;
    if exists(select 1 from jsonb_array_elements_text(profile->'certifications') c where strpos(lower(opportunity->>'eligibility_text'),lower(c))>0) then earned=earned+15; reasons=reasons||'"A listed certification appears in the eligibility information"'::jsonb; end if;
  end if;
  return jsonb_build_object('percentage',case when possible>0 then round(earned/possible*100) else null end,'reasons',reasons,'evidenceAvailable',possible>0);
end $$;

create function public.customer_discover(p_user uuid, filters jsonb default '{}', page_number integer default 1, page_size integer default 20) returns jsonb
language sql stable set search_path=public as $$
with profile as (
 select to_jsonb(o) data from organizations o join organization_members m on m.organization_id=o.id where m.user_id=p_user order by m.created_at limit 1
), base as (
 select o.*, public.customer_match(coalesce((select data from profile),'{}'),to_jsonb(o)) match,
 exists(select 1 from saved_opportunities s join organization_members m on m.organization_id=s.organization_id where m.user_id=p_user and s.opportunity_id=o.id) saved,
 (select r.viewed_at from customer_recent_opportunities r where r.user_id=p_user and r.opportunity_id=o.id) viewed_at
 from procurement_opportunities o
 where o.published_at is not null and o.source_removed_at is null
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
revoke all on function public.customer_match(jsonb,jsonb), public.customer_discover(uuid,jsonb,integer,integer) from public,anon,authenticated;
grant execute on function public.customer_match(jsonb,jsonb), public.customer_discover(uuid,jsonb,integer,integer) to service_role;

create function public.customer_pulse(p_user uuid) returns jsonb language sql stable set search_path=public as $$
with profile as (select to_jsonb(o) data from organizations o join organization_members m on m.organization_id=o.id where m.user_id=p_user order by m.created_at limit 1),
live as (select o.*, (customer_match(coalesce((select data from profile),'{}'),to_jsonb(o))->>'percentage')::integer score from procurement_opportunities o where status in ('OPEN','CLOSING_SOON') and published_at is not null and source_removed_at is null and (deadline_at is null or deadline_at>now()))
select jsonb_build_object(
 'open',(select count(*) from live),'matched',(select count(*) from live where score>0),'strong',(select count(*) from live where score>=80),
 'closing',(select count(*) from live where deadline_at<=now()+interval '7 days'),
 'international',(select count(*) from live where country_code<>'GH' and score>0),
 'saved',(select count(distinct s.opportunity_id) from saved_opportunities s join organization_members m on m.organization_id=s.organization_id where m.user_id=p_user),
 'bids',(select count(*) from user_bid_tracking where user_id=p_user and status not in ('AWARDED','UNSUCCESSFUL','WITHDRAWN')),
 'pipeline',coalesce((select jsonb_object_agg(status,n) from (select status,count(*) n from user_bid_tracking where user_id=p_user group by status) x),'{}'),
 'sectors',coalesce((select jsonb_agg(x) from (select coalesce(sector,'Unclassified') sector,count(*) total from live group by sector order by count(*) desc limit 5) x),'[]'),
 'buyers',coalesce((select jsonb_agg(x) from (select buyer_name,count(*) total from live where score>0 group by buyer_name order by count(*) desc limit 4) x),'[]'),
 'since',(select previous_visit_at from customer_preferences where user_id=p_user),
 'newGhana',(select count(*) from live where country_code='GH' and first_seen_at>coalesce((select previous_visit_at from customer_preferences where user_id=p_user),now())),
 'newInternational',(select count(*) from live where country_code<>'GH' and first_seen_at>coalesce((select previous_visit_at from customer_preferences where user_id=p_user),now())),
 'newMatches',(select count(*) from live where score>=80 and first_seen_at>coalesce((select previous_visit_at from customer_preferences where user_id=p_user),now()))
)
$$;
revoke all on function public.customer_pulse(uuid) from public,anon,authenticated;
grant execute on function public.customer_pulse(uuid) to service_role;
