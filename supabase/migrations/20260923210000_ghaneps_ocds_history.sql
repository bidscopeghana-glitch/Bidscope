-- GHANEPS structured open-data import is separate from web discovery and live tenders.
-- Preserve the publisher's licence/policy links and the existing per-source safeguards.
alter table public.procurement_sources drop constraint if exists procurement_sources_reuse_status_check;
alter table public.procurement_sources add constraint procurement_sources_reuse_status_check
  check (reuse_status in ('official_open_data','explicitly_licensed','written_permission','official_api','public_link_only','permission_unknown','prohibited'));

alter table public.procurement_sources drop constraint if exists procurement_sources_rights_scope_check;
alter table public.procurement_sources add constraint procurement_sources_rights_scope_check check (
  (reuse_status not in ('permission_unknown','prohibited') or
    (not discovery_enabled and not discovery_auto_publish_enabled and not content_reuse_allowed and
     not commercial_reuse_allowed and not document_reuse_allowed and not metadata_reuse_allowed))
  and (reuse_status <> 'public_link_only' or
    (not content_reuse_allowed and not document_reuse_allowed and metadata_reuse_allowed))
  and (reuse_status <> 'official_open_data' or
    (not discovery_enabled and not discovery_auto_publish_enabled and not document_reuse_allowed and
     license_url is not null and permission_evidence is not null))
  and (not discovery_auto_publish_enabled or
    (discovery_enabled and metadata_reuse_allowed and reuse_status not in ('official_api','official_open_data','public_link_only') and commercial_reuse_allowed))
  and (not discovery_enabled or
    (crawl_robots_allowed and crawl_terms_reviewed and metadata_reuse_allowed and
     reuse_status in ('explicitly_licensed','written_permission','public_link_only') and
     (reuse_status = 'public_link_only' or commercial_reuse_allowed) and
     (reuse_status <> 'explicitly_licensed' or (license_name is not null and license_url is not null)) and
     (reuse_status <> 'written_permission' or (permission_evidence is not null and permission_date is not null))))
  and (slug <> 'ghana-ministry-finance' or (not discovery_enabled and not discovery_auto_publish_enabled))
  and (permission_expiry is null or permission_date is null or permission_expiry >= permission_date)
);

create table if not exists public.ocds_processes (
  source_id uuid not null references public.procurement_sources(id) on delete cascade,
  ocid text not null,
  source_hash text not null,
  latest_release_id text not null,
  latest_release_date timestamptz,
  first_publication_date timestamptz,
  title text not null,
  description text,
  buyer_name text,
  buyer_id text,
  category text,
  procurement_method text,
  tender_id text,
  tender_start_at timestamptz,
  tender_end_at timestamptz,
  stage text not null,
  status text not null,
  value numeric,
  currency text,
  award_count integer not null default 0,
  contract_count integer not null default 0,
  supplier_names text[] not null default '{}',
  award_data jsonb not null default '[]'::jsonb,
  contract_data jsonb not null default '[]'::jsonb,
  parties jsonb not null default '[]'::jsonb,
  documents_metadata jsonb not null default '[]'::jsonb,
  release_history jsonb not null default '[]'::jsonb,
  original_source_url text,
  registry_url text not null,
  source_attribution text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_import_run_id uuid references public.source_sync_runs(id) on delete set null,
  primary key (source_id, ocid),
  constraint ocds_processes_ocid_check check (ocid ~ '^ocds-[a-z0-9-]+$')
);
create index if not exists ocds_processes_buyer_idx on public.ocds_processes (buyer_name);
create index if not exists ocds_processes_stage_idx on public.ocds_processes (stage, tender_end_at desc);
create index if not exists ocds_processes_category_idx on public.ocds_processes (category);
create index if not exists ocds_processes_awards_idx on public.ocds_processes (award_count, latest_release_date desc);
create index if not exists ocds_processes_supplier_idx on public.ocds_processes using gin (supplier_names);
alter table public.ocds_processes enable row level security;
revoke all on public.ocds_processes from anon, authenticated;
grant all on public.ocds_processes to service_role;
grant select on public.ocds_processes to authenticated;
drop policy if exists ocds_processes_admin_select on public.ocds_processes;
create policy ocds_processes_admin_select on public.ocds_processes for select to authenticated using (public.is_super_admin());

create or replace function public.ocds_source_stats(p_source_id uuid)
returns table(processes bigint, awards bigint, contracts bigint, current_open bigint)
language sql stable security definer set search_path = public as $$
  select count(*)::bigint,
    coalesce(sum(award_count),0)::bigint,
    coalesce(sum(contract_count),0)::bigint,
    count(*) filter (where status = 'OPEN' and tender_end_at > now())::bigint
  from public.ocds_processes where source_id = p_source_id;
$$;
revoke execute on function public.ocds_source_stats(uuid) from public, anon, authenticated;
grant execute on function public.ocds_source_stats(uuid) to service_role;

create or replace function public.search_ocds_processes(
  p_source_id uuid, p_query text default null, p_buyer text default null,
  p_supplier text default null, p_category text default null, p_year integer default null,
  p_method text default null, p_awarded boolean default null,
  p_min_value numeric default null, p_max_value numeric default null,
  p_currency text default null, p_limit integer default 25, p_offset integer default 0)
returns table(ocid text, title text, buyer_name text, category text,
  procurement_method text, latest_release_date timestamptz, tender_end_at timestamptz,
  stage text, status text, value numeric, currency text, award_count integer,
  contract_count integer, supplier_names text[], original_source_url text,
  source_attribution text)
language sql stable security definer set search_path = public as $$
  select p.ocid,p.title,p.buyer_name,p.category,p.procurement_method,p.latest_release_date,
    p.tender_end_at,p.stage,p.status,p.value,p.currency,p.award_count,p.contract_count,
    p.supplier_names,p.original_source_url,p.source_attribution
  from public.ocds_processes p
  where p.source_id = p_source_id
    and (p_query is null or p.ocid ilike '%' || p_query || '%' or p.title ilike '%' || p_query || '%')
    and (p_buyer is null or p.buyer_name ilike '%' || p_buyer || '%')
    and (p_supplier is null or exists (select 1 from unnest(p.supplier_names) n where n ilike '%' || p_supplier || '%'))
    and (p_category is null or p.category ilike '%' || p_category || '%')
    and (p_year is null or extract(year from coalesce(p.first_publication_date,p.latest_release_date)) = p_year)
    and (p_method is null or p.procurement_method ilike '%' || p_method || '%')
    and (p_awarded is null or (p.award_count > 0) = p_awarded)
    and (p_min_value is null or p.value >= p_min_value)
    and (p_max_value is null or p.value <= p_max_value)
    and (p_currency is null or p.currency = upper(p_currency))
  order by p.latest_release_date desc nulls last, p.ocid
  limit least(greatest(p_limit,1),100) offset greatest(p_offset,0);
$$;
revoke execute on function public.search_ocds_processes(uuid,text,text,text,text,integer,text,boolean,numeric,numeric,text,integer,integer) from public, anon, authenticated;
grant execute on function public.search_ocds_processes(uuid,text,text,text,text,integer,text,boolean,numeric,numeric,text,integer,integer) to service_role;

alter table public.source_sync_runs add column if not exists contract_count integer not null default 0;
alter table public.source_sync_runs add column if not exists no_change boolean not null default false;
alter table public.procurement_sources add column if not exists ocds_import_cursor integer not null default 0;

-- The PPA licence link is preserved. Its destination is intermittently unavailable;
-- this records the registry citation and Ghana's default open-data policy, not
-- an invented claim about the inaccessible page's exact wording.
update public.procurement_sources set
  reuse_status = 'official_open_data',
  license_name = 'PPA / GHANEPS OCDS open-data publication',
  license_url = 'https://www.ppaghana.org/ocds-license',
  permission_evidence = 'OCP registry publication 85 identifies PPA as publisher, links the PPA OCDS licence and publication policy, and offers monthly bulk data. Ghana Open Data Initiative FAQ states commercial reuse is permitted by default for government open datasets, subject to dataset-specific exceptions. Exact linked PPA licence wording could not be retrieved during this review.',
  permission_notes = 'Structured OCDS metadata and process history only. Keep GHANEPS/PPA attribution and original URLs. Do not mirror source PDFs or attachments. Re-review the PPA-specific licence when available.',
  content_reuse_allowed = true,
  commercial_reuse_allowed = true,
  metadata_reuse_allowed = true,
  document_reuse_allowed = false,
  discovery_enabled = false,
  discovery_auto_publish_enabled = false,
  ocds_paused = false,
  ocds_import_cursor = 0,
  last_rights_reviewed_at = now(),
  configuration = coalesce(configuration,'{}'::jsonb) || jsonb_build_object('ocds', coalesce(configuration->'ocds','{}'::jsonb) || jsonb_build_object(
    'publisher','Public Procurement Authority of Ghana / GHANEPS',
    'source_type','official_open_data',
    'registry_url','https://data.open-contracting.org/en/publication/85',
    'license_url','https://www.ppaghana.org/ocds-license',
    'publication_policy_url','https://www.ppaghana.org/ocds-publication-policy',
    'ocid_prefix','ocds-uhveoc',
    'attribution_requirement','Source: GHANEPS / Public Procurement Authority Ghana')),
  updated_at = now()
where slug = 'ghaneps';
