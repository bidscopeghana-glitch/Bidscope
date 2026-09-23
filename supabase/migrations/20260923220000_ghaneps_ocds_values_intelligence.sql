alter table public.ocds_processes
  add column if not exists contract_value numeric,
  add column if not exists contract_currency text,
  add column if not exists award_value numeric,
  add column if not exists award_currency text;

-- Populate already-imported history using disclosed OCDS amounts. Never sum
-- across mixed currencies or infer a value when none is published.
update public.ocds_processes p set
  contract_value = (select case when count(distinct c->'value'->>'currency')=1 then sum((c->'value'->>'amount')::numeric) end
    from jsonb_array_elements(p.contract_data) c where (c->'value'->>'amount') ~ '^[0-9]+(\.[0-9]+)?$' and (c->'value'->>'currency') ~ '^[A-Z]{3}$'),
  contract_currency = (select case when count(distinct c->'value'->>'currency')=1 then min(c->'value'->>'currency') end
    from jsonb_array_elements(p.contract_data) c where (c->'value'->>'amount') ~ '^[0-9]+(\.[0-9]+)?$' and (c->'value'->>'currency') ~ '^[A-Z]{3}$'),
  award_value = (select case when count(distinct a->'value'->>'currency')=1 then sum((a->'value'->>'amount')::numeric) end
    from jsonb_array_elements(p.award_data) a where (a->'value'->>'amount') ~ '^[0-9]+(\.[0-9]+)?$' and (a->'value'->>'currency') ~ '^[A-Z]{3}$'),
  award_currency = (select case when count(distinct a->'value'->>'currency')=1 then min(a->'value'->>'currency') end
    from jsonb_array_elements(p.award_data) a where (a->'value'->>'amount') ~ '^[0-9]+(\.[0-9]+)?$' and (a->'value'->>'currency') ~ '^[A-Z]{3}$');

create index if not exists ocds_processes_contract_value_idx on public.ocds_processes(contract_currency, contract_value);

drop function if exists public.search_ocds_processes(uuid,text,text,text,text,integer,text,boolean,numeric,numeric,text,integer,integer);
create function public.search_ocds_processes(
  p_source_id uuid, p_query text default null, p_buyer text default null,
  p_supplier text default null, p_category text default null, p_year integer default null,
  p_method text default null, p_awarded boolean default null,
  p_min_value numeric default null, p_max_value numeric default null,
  p_currency text default null, p_limit integer default 25, p_offset integer default 0)
returns table(ocid text, title text, buyer_name text, category text,
  procurement_method text, latest_release_date timestamptz, tender_end_at timestamptz,
  stage text, status text, value numeric, currency text, contract_value numeric,
  contract_currency text, award_value numeric, award_currency text,
  award_count integer, contract_count integer, supplier_names text[], original_source_url text,
  source_attribution text)
language sql stable security definer set search_path = public as $$
  select p.ocid,p.title,p.buyer_name,p.category,p.procurement_method,p.latest_release_date,
    p.tender_end_at,p.stage,p.status,p.value,p.currency,p.contract_value,p.contract_currency,
    p.award_value,p.award_currency,p.award_count,p.contract_count,p.supplier_names,
    p.original_source_url,p.source_attribution
  from public.ocds_processes p
  where p.source_id = p_source_id
    and (p_query is null or p.ocid ilike '%' || p_query || '%' or p.title ilike '%' || p_query || '%')
    and (p_buyer is null or p.buyer_name ilike '%' || p_buyer || '%')
    and (p_supplier is null or exists (select 1 from unnest(p.supplier_names) n where n ilike '%' || p_supplier || '%'))
    and (p_category is null or p.category ilike '%' || p_category || '%')
    and (p_year is null or extract(year from coalesce(p.first_publication_date,p.latest_release_date)) = p_year)
    and (p_method is null or p.procurement_method ilike '%' || p_method || '%')
    and (p_awarded is null or (p.award_count > 0) = p_awarded)
    and (p_min_value is null or p.contract_value >= p_min_value)
    and (p_max_value is null or p.contract_value <= p_max_value)
    and (p_currency is null or p.contract_currency = upper(p_currency))
  order by p.latest_release_date desc nulls last, p.ocid
  limit least(greatest(p_limit,1),100) offset greatest(p_offset,0);
$$;
revoke execute on function public.search_ocds_processes(uuid,text,text,text,text,integer,text,boolean,numeric,numeric,text,integer,integer) from public, anon, authenticated;
grant execute on function public.search_ocds_processes(uuid,text,text,text,text,integer,text,boolean,numeric,numeric,text,integer,integer) to service_role;

create or replace function public.ocds_intelligence_summary(p_source_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
select jsonb_build_object(
  'buyers', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
    select buyer_name as name, count(*) as processes, sum(award_count) as awards,
      sum(contract_count) as contracts, count(distinct category) as categories
    from public.ocds_processes where source_id=p_source_id and buyer_name is not null
    group by buyer_name order by count(*) desc limit 8) x),
  'categories', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
    select category as name, count(*) as processes, count(distinct buyer_name) as buyers,
      sum(award_count) as awards, sum(contract_count) as contracts
    from public.ocds_processes where source_id=p_source_id and category is not null
    group by category order by count(*) desc limit 8) x),
  'suppliers', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
    select supplier as name, count(*) as processes
    from public.ocds_processes p cross join lateral unnest(p.supplier_names) supplier
    where p.source_id=p_source_id group by supplier order by count(*) desc limit 8) x));
$$;
revoke execute on function public.ocds_intelligence_summary(uuid) from public, anon, authenticated;
grant execute on function public.ocds_intelligence_summary(uuid) to service_role;
