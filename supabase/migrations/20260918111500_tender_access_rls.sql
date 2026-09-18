-- Sensitive procurement records are served only through BidScope's server-side
-- entitlement gate. The service role remains available to API routes and jobs.
begin;

drop policy if exists procurement_opportunities_public_read on public.procurement_opportunities;
drop policy if exists opportunity_sources_public_read on public.opportunity_sources;
drop policy if exists opportunity_documents_public_read on public.opportunity_documents;

revoke select on table public.procurement_opportunities from anon, authenticated, public;
revoke select on table public.opportunity_sources from anon, authenticated, public;
revoke select on table public.opportunity_documents from anon, authenticated, public;
revoke select on table public.opportunities from anon, authenticated, public;
revoke select on table public.awards from anon, authenticated, public;
revoke select on table public.award_suppliers from anon, authenticated, public;
revoke select on table public.procuring_entities from anon, authenticated, public;

do $$
declare
  target text;
  columns text;
begin
  foreach target in array array[
    'procurement_opportunities','opportunity_sources','opportunity_documents',
    'opportunities','awards','award_suppliers','procuring_entities'
  ] loop
    select string_agg(quote_ident(column_name), ', ')
      into columns
      from information_schema.columns
     where table_schema = 'public' and table_name = target;
    if columns is not null then
      execute format('revoke select (%s) on public.%I from anon, authenticated, public', columns, target);
    end if;
  end loop;
end $$;

grant all on table public.procurement_opportunities, public.opportunity_sources,
  public.opportunity_documents, public.opportunities, public.awards,
  public.award_suppliers, public.procuring_entities to service_role;

commit;
