-- Additive publication boundary. Drafts, tender history and existing grants remain unchanged.
begin;
create table public.bidscope_shop_publications(
 product_id text primary key check(product_id ~ '^[A-Za-z0-9_-]{1,200}$'),
 source_id text not null default 'cj' check(source_id='cj'),
 title text not null,description text not null check(length(description) between 40 and 6000 and description !~ '[<>]'),
 category text not null,image_url text not null,origin text not null check(origin ~ '^[A-Z]{2}$'),
 snapshot jsonb not null check(coalesce(jsonb_typeof(snapshot->'variants')='array' and jsonb_array_length(snapshot->'variants') between 1 and 1000,false)),
 min_usd_minor bigint not null check(min_usd_minor>=0),checked_at timestamptz not null,
 rights_evidence text not null check(length(trim(rights_evidence)) between 20 and 3000),
 media_evidence text not null check(length(trim(media_evidence)) between 20 and 3000),
 status text not null check(status in('approved','retired')),approved_by uuid not null references auth.users(id),
 approved_at timestamptz not null default now(),review_expires_at timestamptz not null,
 search_document tsvector generated always as(to_tsvector('simple',title||' '||category||' '||description)) stored,
 check(review_expires_at>approved_at and review_expires_at<=approved_at+interval '366 days')
);
create index bidscope_shop_publications_search on public.bidscope_shop_publications using gin(search_document);
create index bidscope_shop_publications_browse on public.bidscope_shop_publications(status,approved_at desc,product_id);
create function public.bidscope_shop_publication_categories() returns table(category text)
language sql stable security definer set search_path=pg_catalog,public as $$
 select distinct p.category from public.bidscope_shop_publications p where p.status='approved' and p.review_expires_at>now() order by p.category limit 1000
$$;
revoke all on function public.bidscope_shop_publication_categories() from public,anon,authenticated;
grant execute on function public.bidscope_shop_publication_categories() to service_role;
create table public.bidscope_shop_publication_audit(
 id uuid primary key default gen_random_uuid(),product_id text not null references public.bidscope_shop_publications(product_id),
 actor_id uuid not null references auth.users(id),action text not null check(action in('approve','retire')),
 evidence jsonb not null,created_at timestamptz not null default now()
);
alter table public.bidscope_shop_publications enable row level security;
alter table public.bidscope_shop_publication_audit enable row level security;
revoke all on public.bidscope_shop_publications,public.bidscope_shop_publication_audit from public,anon,authenticated;
grant all on public.bidscope_shop_publications,public.bidscope_shop_publication_audit to service_role;
create function public.bidscope_shop_publish(p_actor uuid,p_product text,p_details jsonb) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 insert into public.bidscope_shop_publications(product_id,title,description,category,image_url,origin,snapshot,min_usd_minor,checked_at,rights_evidence,media_evidence,status,approved_by,review_expires_at)
 values(p_product,p_details->>'title',p_details->>'description',p_details->>'category',p_details->>'image',p_details->>'origin',p_details->'snapshot',(p_details->>'minUsdMinor')::bigint,(p_details->>'checkedAt')::timestamptz,p_details->>'rightsEvidence',p_details->>'mediaEvidence','approved',p_actor,(p_details->>'reviewExpiresAt')::timestamptz)
 on conflict(product_id) do update set title=excluded.title,description=excluded.description,category=excluded.category,image_url=excluded.image_url,origin=excluded.origin,snapshot=excluded.snapshot,min_usd_minor=excluded.min_usd_minor,checked_at=excluded.checked_at,rights_evidence=excluded.rights_evidence,media_evidence=excluded.media_evidence,status='approved',approved_by=p_actor,approved_at=now(),review_expires_at=excluded.review_expires_at;
 insert into public.bidscope_shop_publication_audit(product_id,actor_id,action,evidence) values(p_product,p_actor,'approve',p_details);
end $$;
create function public.bidscope_shop_retire_publication(p_actor uuid,p_product text,p_reason text) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if length(trim(p_reason)) not between 10 and 1000 then raise exception 'Retirement reason required';end if;
 update public.bidscope_shop_publications set status='retired' where product_id=p_product;
 if not found then raise exception 'Publication not found';end if;
 insert into public.bidscope_shop_publication_audit(product_id,actor_id,action,evidence) values(p_product,p_actor,'retire',jsonb_build_object('reason',p_reason));
end $$;
revoke all on function public.bidscope_shop_publish(uuid,text,jsonb),public.bidscope_shop_retire_publication(uuid,text,text) from public,anon,authenticated;
grant execute on function public.bidscope_shop_publish(uuid,text,jsonb),public.bidscope_shop_retire_publication(uuid,text,text) to service_role;
commit;
