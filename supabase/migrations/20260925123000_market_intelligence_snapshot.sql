-- Aggregate only published, non-removed records. Values are never combined across currencies.
create index if not exists procurement_opportunities_market_published_idx
on public.procurement_opportunities(published_at desc)
where published_at is not null and source_removed_at is null;

create or replace function public.market_intelligence_snapshot() returns jsonb
language sql stable set search_path=public as $$
with indexed as (
  select id, published_at, deadline_at, status, sector, region, buyer_name, estimated_value, currency
  from public.procurement_opportunities
  where published_at is not null and source_removed_at is null and status <> 'DRAFT'
), live as (
  select * from indexed where status in ('OPEN','CLOSING_SOON') and (deadline_at is null or deadline_at > now())
), daily as (
  select published_at::date as bucket_date, count(*) total,
    coalesce(sum(estimated_value) filter (where currency='GHS' and estimated_value > 0),0) value_ghs,
    count(*) filter (where currency='GHS' and estimated_value > 0) valued_count
  from indexed
  group by 1 order by 1
), sectors as (
  select coalesce(nullif(trim(sector),''),'Unclassified') name,
    count(*) filter (where published_at >= now()-interval '30 days') recent,
    count(*) filter (where published_at < now()-interval '30 days' and published_at >= now()-interval '60 days') previous,
    count(*) filter (where status in ('OPEN','CLOSING_SOON') and (deadline_at is null or deadline_at > now())) active,
    count(*) filter (where status in ('OPEN','CLOSING_SOON') and deadline_at between now() and now()+interval '7 days') closing,
    coalesce(sum(estimated_value) filter (where status in ('OPEN','CLOSING_SOON') and (deadline_at is null or deadline_at > now()) and currency='GHS' and estimated_value > 0),0) value_ghs,
    count(*) filter (where status in ('OPEN','CLOSING_SOON') and (deadline_at is null or deadline_at > now()) and currency='GHS' and estimated_value > 0) valued_count
  from indexed group by 1
), buyers as (
  select buyer_name name, count(*) active,
    coalesce(sum(estimated_value) filter (where currency='GHS' and estimated_value > 0),0) value_ghs,
    count(*) filter (where currency='GHS' and estimated_value > 0) valued_count
  from live where nullif(trim(buyer_name),'') is not null
  group by 1 order by 2 desc limit 8
), regions as (
  select coalesce(nullif(trim(region),''),'Unspecified') name, count(*) active
  from live group by 1 order by 2 desc limit 12
), heatmap as (
  select coalesce(nullif(trim(region),''),'Unspecified') region,
    coalesce(nullif(trim(sector),''),'Unclassified') sector, count(*) active
  from live
  where coalesce(nullif(trim(region),''),'Unspecified') in (select name from regions order by active desc limit 6)
    and coalesce(nullif(trim(sector),''),'Unclassified') in (select name from sectors order by active desc limit 6)
  group by 1,2
)
select jsonb_build_object(
  'asOf',now(), 'indexed',(select count(*) from indexed), 'active',(select count(*) from live),
  'newWeek',(select count(*) from indexed where published_at >= now()-interval '7 days'),
  'closingWeek',(select count(*) from live where deadline_at <= now()+interval '7 days'),
  'awarded',(select count(*) from indexed where status='AWARDED'),
  'valueGhs',(select sum(estimated_value) from live where currency='GHS' and estimated_value > 0),
  'valuedGhsCount',(select count(*) from live where currency='GHS' and estimated_value > 0),
  'series',coalesce((select jsonb_agg(jsonb_build_object('date',bucket_date,'count',total,'valueGhs',value_ghs,'valuedCount',valued_count) order by bucket_date) from daily),'[]'::jsonb),
  'sectors',coalesce((select jsonb_agg(jsonb_build_object('name',name,'recent',recent,'previous',previous,'active',active,'closing',closing,'valueGhs',value_ghs,'valuedCount',valued_count) order by active desc) from sectors),'[]'::jsonb),
  'buyers',coalesce((select jsonb_agg(jsonb_build_object('name',name,'active',active,'valueGhs',value_ghs,'valuedCount',valued_count)) from buyers),'[]'::jsonb),
  'regions',coalesce((select jsonb_agg(jsonb_build_object('name',name,'active',active)) from regions),'[]'::jsonb),
  'heatmap',coalesce((select jsonb_agg(jsonb_build_object('region',region,'sector',sector,'active',active)) from heatmap),'[]'::jsonb)
);
$$;
revoke all on function public.market_intelligence_snapshot() from public,anon,authenticated;
grant execute on function public.market_intelligence_snapshot() to service_role;
