-- Activate the official, unauthenticated World Bank open-data integration.
alter table public.procurement_sources drop constraint if exists procurement_sources_integration_type_check;
alter table public.procurement_sources add constraint procurement_sources_integration_type_check
  check (integration_type in ('API', 'OPEN_API', 'OPEN_DATA', 'RSS', 'STRUCTURED_WEB', 'MANUAL', 'DISABLED'));

create table if not exists public.procurement_projects (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.procurement_sources(id) on delete cascade,
  external_project_id text not null,
  name text not null,
  country text,
  country_code text,
  region text,
  sector text,
  status text,
  financing_institution text not null default 'World Bank Group',
  official_url text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  last_verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_project_id)
);

alter table public.procurement_opportunities add column if not exists project_id uuid references public.procurement_projects(id) on delete set null;
alter table public.awards add column if not exists procurement_source_id uuid references public.procurement_sources(id) on delete set null;
alter table public.awards add column if not exists project_id uuid references public.procurement_projects(id) on delete set null;
alter table public.source_sync_runs add column if not exists ghana_opportunity_count integer not null default 0;
alter table public.source_sync_runs add column if not exists project_count integer not null default 0;
alter table public.source_sync_runs add column if not exists award_count integer not null default 0;

create index if not exists procurement_projects_source_external_idx on public.procurement_projects(source_id, external_project_id);
create index if not exists procurement_opportunities_project_idx on public.procurement_opportunities(project_id);
create index if not exists awards_procurement_source_idx on public.awards(procurement_source_id, award_date desc);
create index if not exists awards_project_idx on public.awards(project_id);

drop trigger if exists procurement_projects_set_updated_at on public.procurement_projects;
create trigger procurement_projects_set_updated_at before update on public.procurement_projects for each row execute function public.set_updated_at();

alter table public.procurement_projects enable row level security;
drop policy if exists procurement_projects_public_read on public.procurement_projects;
create policy procurement_projects_public_read on public.procurement_projects for select to anon, authenticated using (true);
grant select on public.procurement_projects to anon, authenticated;
grant all on public.procurement_projects to service_role;

update public.procurement_sources set
  name = 'World Bank',
  organisation = 'World Bank Group',
  integration_type = 'OPEN_API',
  implementation_status = 'LIVE',
  api_enabled = true,
  api_key_required = false,
  environment_key_name = null,
  endpoint_url = 'https://search.worldbank.org/api/v2/procnotices',
  sync_enabled = true,
  sync_frequency = '6 hours',
  status = 'ACTIVE',
  trust_level = 'VERIFIED_OFFICIAL',
  configuration = jsonb_build_object(
    'authentication', 'NONE',
    'classification', 'Official public source',
    'country_filter', 'Ghana',
    'projects_endpoint', 'https://search.worldbank.org/api/v2/projects',
    'awards_endpoint', 'https://datacatalogapi.worldbank.org/dexapps/fone/api/apiservice?datasetId=DS00005&resourceId=RS00005&type=json',
    'license', 'CC BY 4.0'
  )
where slug = 'world-bank';
