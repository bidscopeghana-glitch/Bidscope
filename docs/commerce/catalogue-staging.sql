-- Additive private draft catalogue. No existing tables, rights or billing are changed.
-- Run only in the confirmed BidScope project, after reviewing the disk budget.
begin;
create table public.bidscope_catalogue_drafts(
 source_id text not null check(source_id='cj'), supplier_product_id text not null,
 title text not null, sku text not null default '', category text not null, category_id text not null,
 thumbnail_url text not null, supplier_price_text text not null default '',
 min_usd_minor bigint check(min_usd_minor>=0),max_usd_minor bigint check(max_usd_minor>=min_usd_minor),
 synced_at timestamptz not null,
 publication_status text not null default 'draft' check(publication_status in('draft','held','retired')),
 reuse_status text not null default 'permission_unknown' check(reuse_status in('explicitly_licensed','written_permission','official_api','public_link_only','permission_unknown','prohibited')),
 permission_evidence text,permission_reviewed_at timestamptz,
 primary key(source_id,supplier_product_id),
 search_document tsvector generated always as(to_tsvector('simple'::regconfig,title||' '||sku||' '||category)) stored
);
create index bidscope_catalogue_category on public.bidscope_catalogue_drafts(category,supplier_product_id);
create index bidscope_catalogue_price on public.bidscope_catalogue_drafts(min_usd_minor,supplier_product_id);
create index bidscope_catalogue_search on public.bidscope_catalogue_drafts using gin(search_document);
alter table public.bidscope_catalogue_drafts enable row level security;
revoke all on public.bidscope_catalogue_drafts from public,anon,authenticated,service_role;
grant select,insert,update on public.bidscope_catalogue_drafts to service_role;
comment on table public.bidscope_catalogue_drafts is 'Private CJ draft metadata only. Publication is impossible under this status constraint. No customer grants or policies exist.';
commit;
-- Verification (read-only):
select c.relname,c.relrowsecurity from pg_class c where c.oid='public.bidscope_catalogue_drafts'::regclass;
select grantee,privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='bidscope_catalogue_drafts';
