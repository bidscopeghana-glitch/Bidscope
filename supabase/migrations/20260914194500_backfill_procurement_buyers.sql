-- Populate the buyer intelligence catalogue from canonical opportunity data.
-- This is deterministic, idempotent and preserves every source record.
with candidates as (
  select country_code,
         min(trim(buyer_name)) as name,
         coalesce(nullif(trim(both '-' from regexp_replace(lower(trim(buyer_name)),'[^a-z0-9]+','-','g')),''),'buyer-'||substr(md5(country_code||':'||buyer_name),1,12)) as slug,
         min(buyer_type) as entity_type,
         min(region) as region,
         min(official_source_url) as source_url
  from public.procurement_opportunities
  where nullif(trim(buyer_name),'') is not null
  group by country_code,coalesce(nullif(trim(both '-' from regexp_replace(lower(trim(buyer_name)),'[^a-z0-9]+','-','g')),''),'buyer-'||substr(md5(country_code||':'||buyer_name),1,12))
)
insert into public.procuring_entities(country_code,name,slug,entity_type,region,source_url,metadata)
select country_code,name,slug,entity_type,region,source_url,'{"derived_from":"canonical procurement opportunities"}'::jsonb from candidates
on conflict(country_code,slug) do update set
  name=excluded.name,
  entity_type=coalesce(public.procuring_entities.entity_type,excluded.entity_type),
  region=coalesce(public.procuring_entities.region,excluded.region),
  source_url=coalesce(public.procuring_entities.source_url,excluded.source_url),
  updated_at=now();

update public.procurement_opportunities opportunity
set buyer_normalized_id=buyer.id
from public.procuring_entities buyer
where opportunity.buyer_normalized_id is null
  and buyer.country_code=opportunity.country_code
  and buyer.slug=coalesce(nullif(trim(both '-' from regexp_replace(lower(trim(opportunity.buyer_name)),'[^a-z0-9]+','-','g')),''),'buyer-'||substr(md5(opportunity.country_code||':'||opportunity.buyer_name),1,12));
