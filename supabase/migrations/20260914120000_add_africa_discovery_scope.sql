-- Add an Africa-specific discovery scope without treating geography as proof of eligibility.
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
 and (case when filters->>'stage'='upcoming' then o.status='UPCOMING' when filters->>'collection' in ('saved','recent') then o.status<>'DRAFT' else o.status in ('OPEN','CLOSING_SOON') and (o.deadline_at is null or o.deadline_at>now()) end)
 and (
   coalesce(filters->>'scope','all')='all'
   or (filters->>'scope'='ghana' and o.country_code='GH')
   or (filters->>'scope'='international' and o.country_code<>'GH')
   or (filters->>'scope'='africa' and (
     o.source_name in ('African Union','ECOWAS','African Development Bank')
     or o.country_code = any(array['DZ','AO','BJ','BW','BF','BI','CV','CM','CF','TD','KM','CD','CG','CI','DJ','EG','GQ','ER','SZ','ET','GA','GM','GH','GN','GW','KE','LS','LR','LY','MG','MW','ML','MR','MU','MA','MZ','NA','NE','NG','RW','ST','SN','SC','SL','SO','ZA','SS','SD','TZ','TG','TN','UG','ZM','ZW'])
   ))
 )
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

-- Repair existing UK rows that incorrectly link to machine-readable collection endpoints.
with contracts_finder_links as (
  select o.id,
    (select document->>'url'
     from jsonb_array_elements(coalesce(o.raw_payload->'tender'->'documents','[]'::jsonb)) document
     where document->>'url' like 'https://www.contractsfinder.service.gov.uk/Notice/%'
     limit 1) notice_url
  from public.procurement_opportunities o
  where o.source_name = 'UK Contracts Finder'
)
update public.procurement_opportunities o
set official_source_url = resolved.notice_url,
    official_tender_url = resolved.notice_url,
    documents_url = coalesce(o.documents_url, resolved.notice_url)
from contracts_finder_links resolved
where o.id = resolved.id and resolved.notice_url is not null;

update public.procurement_opportunities
set official_source_url = 'https://www.find-tender.service.gov.uk/Notice/' || (raw_payload->>'id'),
    official_tender_url = 'https://www.find-tender.service.gov.uk/Notice/' || (raw_payload->>'id'),
    documents_url = coalesce(documents_url, 'https://www.find-tender.service.gov.uk/Notice/' || (raw_payload->>'id'))
where source_name = 'UK Find a Tender'
  and raw_payload->>'id' ~ '^\d{6}-\d{4}$';

update public.opportunity_sources os
set official_url = o.official_tender_url,
    last_verified_at = now()
from public.procurement_opportunities o
where os.opportunity_id = o.id
  and o.source_name in ('UK Contracts Finder','UK Find a Tender')
  and o.official_tender_url is not null;
