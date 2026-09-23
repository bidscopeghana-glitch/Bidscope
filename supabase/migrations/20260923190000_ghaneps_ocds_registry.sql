-- Extend the existing GHANEPS source and source-sync audit trail. No rights are granted here.
alter table public.procurement_sources
  add column if not exists ocds_paused boolean not null default true,
  add column if not exists ocds_limited_passed boolean not null default false,
  add column if not exists ocds_dataset_etag text,
  add column if not exists ocds_dataset_last_modified text,
  add column if not exists ocds_last_sync_at timestamptz;

alter table public.source_sync_runs
  add column if not exists mode text,
  add column if not exists dataset_hash text,
  add column if not exists dataset_etag text,
  add column if not exists dataset_last_modified text,
  add column if not exists unique_ocids integer not null default 0,
  add column if not exists active_count integer not null default 0,
  add column if not exists closed_count integer not null default 0,
  add column if not exists awarded_count integer not null default 0,
  add column if not exists unchanged_count integer not null default 0;

alter table public.opportunity_sources
  add column if not exists release_id text,
  add column if not exists registry_url text,
  add column if not exists original_source_url text,
  add column if not exists latest_import_run_id uuid references public.source_sync_runs(id) on delete set null,
  add column if not exists last_seen_at timestamptz;

create table if not exists public.ocds_release_history (
  source_id uuid not null references public.procurement_sources(id) on delete cascade,
  ocid text not null,
  release_id text not null,
  release_date timestamptz,
  tags text[] not null default '{}',
  source_hash text not null,
  import_run_id uuid references public.source_sync_runs(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (source_id, ocid, release_id)
);
create index if not exists ocds_release_history_ocid_idx on public.ocds_release_history(ocid,release_date desc);
alter table public.ocds_release_history enable row level security;
revoke all on public.ocds_release_history from anon, authenticated;
grant all on public.ocds_release_history to service_role;
grant select on public.ocds_release_history to authenticated;
drop policy if exists ocds_release_history_admin_select on public.ocds_release_history;
create policy ocds_release_history_admin_select on public.ocds_release_history for select to authenticated using (public.is_super_admin());

create index if not exists procurement_opportunities_external_reference_idx on public.procurement_opportunities(external_reference);
create index if not exists procurement_opportunities_deadline_status_idx on public.procurement_opportunities(status,deadline_at);
create index if not exists procurement_opportunities_source_idx on public.procurement_opportunities(source_id);
create index if not exists opportunity_sources_last_seen_idx on public.opportunity_sources(source_id,last_seen_at desc);

update public.procurement_sources set
  official_source = true,
  configuration = coalesce(configuration,'{}'::jsonb) || jsonb_build_object(
    'ocds', jsonb_build_object(
      'publisher','Ghana Public Procurement Authority',
      'dataset_title','GHANEPS procurement data',
      'registry_url','https://data.open-contracting.org/en/publication/85',
      'license_url','https://www.ppaghana.org/ocds-license',
      'publication_policy_url','https://www.ppaghana.org/ocds-publication-policy',
      'ocid_prefix','ocds-uhveoc',
      'last_registry_retrieval_date','2026-07-06',
      'coverage_start','2019-08',
      'coverage_end','2026-06',
      'formats',jsonb_build_array('JSON','CSV','Excel'),
      'attribution_requirement','Unverified: follow linked licence and publication policy before reuse'
    )
  ),
  ocds_paused = true,
  ocds_limited_passed = false,
  discovery_enabled = false,
  discovery_auto_publish_enabled = false,
  updated_at = now()
where slug = 'ghaneps';
