-- Public discovery must pass through the server-side preview serializer.
-- Preserve authenticated and service-role access. Revoke both table and
-- column grants: PostgreSQL table-level REVOKE alone leaves column grants.
begin;
do $$
declare target text; columns text;
begin
  foreach target in array array['procurement_opportunities','opportunities','opportunity_sources','opportunity_documents','awards','award_suppliers'] loop
    execute format('revoke select on table public.%I from anon, public', target);
    select string_agg(quote_ident(column_name), ', ') into columns
    from information_schema.columns where table_schema='public' and table_name=target;
    if columns is not null then
      execute format('revoke select (%s) on public.%I from anon, public', columns, target);
    end if;
  end loop;
end $$;
commit;
