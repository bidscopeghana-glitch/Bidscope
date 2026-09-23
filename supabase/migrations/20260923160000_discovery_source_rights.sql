-- Fail closed: no pre-existing source acquires discovery rights by migration.
alter table public.procurement_sources
  add column if not exists official_source boolean not null default false,
  add column if not exists reuse_status text not null default 'permission_unknown',
  add column if not exists license_name text,
  add column if not exists license_url text,
  add column if not exists permission_evidence text,
  add column if not exists permission_date date,
  add column if not exists permission_expiry date,
  add column if not exists permission_notes text,
  add column if not exists content_reuse_allowed boolean not null default false,
  add column if not exists commercial_reuse_allowed boolean not null default false,
  add column if not exists document_reuse_allowed boolean not null default false,
  add column if not exists metadata_reuse_allowed boolean not null default false,
  add column if not exists last_rights_reviewed_at timestamptz,
  add column if not exists discovery_auto_publish_enabled boolean not null default false;

-- Earlier discovery deployments had no formal rights evidence. Revoke any
-- discovery toggles before adding fail-closed constraints; legacy sync is untouched.
update public.procurement_sources set discovery_enabled = false,
  discovery_auto_publish_enabled = false where discovery_enabled or discovery_auto_publish_enabled;

alter table public.procurement_sources drop constraint if exists procurement_sources_reuse_status_check;
alter table public.procurement_sources add constraint procurement_sources_reuse_status_check
  check (reuse_status in ('explicitly_licensed','written_permission','official_api','public_link_only','permission_unknown','prohibited'));
alter table public.procurement_sources drop constraint if exists procurement_sources_rights_scope_check;
alter table public.procurement_sources add constraint procurement_sources_rights_scope_check check (
  (reuse_status not in ('permission_unknown','prohibited') or
    (not discovery_enabled and not discovery_auto_publish_enabled and not content_reuse_allowed and
     not commercial_reuse_allowed and not document_reuse_allowed and not metadata_reuse_allowed))
  and (reuse_status <> 'public_link_only' or
    (not content_reuse_allowed and not document_reuse_allowed and metadata_reuse_allowed))
  and (not discovery_auto_publish_enabled or
    (discovery_enabled and metadata_reuse_allowed and reuse_status not in ('official_api','public_link_only') and commercial_reuse_allowed))
  and (not discovery_enabled or
    (crawl_robots_allowed and crawl_terms_reviewed and metadata_reuse_allowed and
     reuse_status in ('explicitly_licensed','written_permission','public_link_only') and
     (reuse_status = 'public_link_only' or commercial_reuse_allowed) and
     (reuse_status <> 'explicitly_licensed' or (license_name is not null and license_url is not null)) and
     (reuse_status <> 'written_permission' or (permission_evidence is not null and permission_date is not null))))
  and (slug <> 'ghana-ministry-finance' or (not discovery_enabled and not discovery_auto_publish_enabled))
  and (permission_expiry is null or permission_date is null or permission_expiry >= permission_date)
);

-- An existing GHANEPS registry row is reused, never duplicated.
update public.procurement_sources set
  official_source = true, reuse_status = 'permission_unknown', discovery_enabled = false,
  discovery_auto_publish_enabled = false, content_reuse_allowed = false,
  commercial_reuse_allowed = false, document_reuse_allowed = false, metadata_reuse_allowed = false,
  crawl_robots_allowed = false, crawl_terms_reviewed = false, updated_at = now()
where slug = 'ghaneps';

-- Ministry of Finance remains a disabled candidate regardless of earlier crawl checks.
update public.procurement_sources set discovery_enabled = false,
  discovery_auto_publish_enabled = false, updated_at = now()
where slug = 'ghana-ministry-finance';

create table if not exists public.source_rights_audit (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.procurement_sources(id) on delete cascade,
  actor_user_id uuid,
  old_rights jsonb not null,
  new_rights jsonb not null,
  changed_at timestamptz not null default now()
);
create index if not exists source_rights_audit_source_idx on public.source_rights_audit(source_id,changed_at desc);
alter table public.source_rights_audit enable row level security;
revoke all on public.source_rights_audit from anon, authenticated;
grant all on public.source_rights_audit to service_role;
grant select on public.source_rights_audit to authenticated;
drop policy if exists source_rights_audit_admin_select on public.source_rights_audit;
create policy source_rights_audit_admin_select on public.source_rights_audit for select to authenticated using (public.is_super_admin());

create or replace function public.audit_source_rights() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (to_jsonb(old) -> 'reuse_status') is distinct from (to_jsonb(new) -> 'reuse_status') or
     (to_jsonb(old) -> 'permission_evidence') is distinct from (to_jsonb(new) -> 'permission_evidence') or
     (to_jsonb(old) -> 'permission_expiry') is distinct from (to_jsonb(new) -> 'permission_expiry') or
     (to_jsonb(old) -> 'content_reuse_allowed') is distinct from (to_jsonb(new) -> 'content_reuse_allowed') or
     (to_jsonb(old) -> 'commercial_reuse_allowed') is distinct from (to_jsonb(new) -> 'commercial_reuse_allowed') or
     (to_jsonb(old) -> 'document_reuse_allowed') is distinct from (to_jsonb(new) -> 'document_reuse_allowed') or
     (to_jsonb(old) -> 'metadata_reuse_allowed') is distinct from (to_jsonb(new) -> 'metadata_reuse_allowed') or
     (to_jsonb(old) -> 'discovery_auto_publish_enabled') is distinct from (to_jsonb(new) -> 'discovery_auto_publish_enabled') then
    insert into public.source_rights_audit(source_id,actor_user_id,old_rights,new_rights)
    values (new.id,auth.uid(),to_jsonb(old),to_jsonb(new));
  end if;
  return new;
end $$;
drop trigger if exists procurement_source_rights_audit on public.procurement_sources;
create trigger procurement_source_rights_audit after update on public.procurement_sources
  for each row execute function public.audit_source_rights();

-- Replace the transactional claim so a stale UI or direct RPC cannot bypass rights.
create or replace function public.claim_discovery_crawl(p_source_id uuid default null)
returns table(job_id uuid, source_id uuid)
language plpgsql security definer set search_path = public as $$
declare selected_source uuid; selected_job uuid; cfg public.discovery_settings%rowtype;
begin
  perform pg_advisory_xact_lock(84721900);
  select * into cfg from public.discovery_settings where singleton_key = 'default';
  if not coalesce(cfg.enabled,false) then return; end if;
  if (select count(*) from public.discovery_crawl_jobs where started_at >= date_trunc('day',now() at time zone 'utc') at time zone 'utc') >= cfg.max_crawls_per_day then return; end if;
  if (select count(*) from public.discovery_crawl_jobs where status in ('reserved','running')) >= cfg.max_concurrent_jobs then return; end if;
  select s.id into selected_source from public.procurement_sources s
    where s.discovery_enabled and s.crawl_robots_allowed and s.crawl_terms_reviewed
      and s.reuse_status in ('explicitly_licensed','written_permission','public_link_only')
      and s.metadata_reuse_allowed and (s.reuse_status = 'public_link_only' or s.commercial_reuse_allowed)
      and (s.permission_expiry is null or s.permission_expiry >= current_date)
      and (s.reuse_status <> 'explicitly_licensed' or (s.license_name is not null and s.license_url is not null))
      and (s.reuse_status <> 'written_permission' or (s.permission_evidence is not null and s.permission_date is not null))
      and (p_source_id is null or s.id = p_source_id)
      and (not s.crawl_requires_rendering or (
        cfg.max_rendered_pages_per_day >= s.crawl_max_pages and
        coalesce((select sum(rs.crawl_max_pages) from public.discovery_crawl_jobs j
          join public.procurement_sources rs on rs.id=j.source_id
          where j.started_at >= date_trunc('day',now() at time zone 'utc') at time zone 'utc'
          and rs.crawl_requires_rendering),0) + s.crawl_max_pages <= cfg.max_rendered_pages_per_day))
      and s.crawl_consecutive_failures < 5
      and (p_source_id is not null or s.crawl_next_at is null or s.crawl_next_at <= now())
    order by s.crawl_next_at nulls first,s.id limit 1 for update skip locked;
  if selected_source is null then return; end if;
  update public.procurement_sources set crawl_next_at=now()+make_interval(hours=>crawl_interval_hours),crawl_last_at=now(),updated_at=now() where id=selected_source;
  insert into public.discovery_crawl_jobs(source_id) values(selected_source) returning id into selected_job;
  return query select selected_job,selected_source;
end $$;
revoke execute on function public.claim_discovery_crawl(uuid) from public, anon, authenticated;
grant execute on function public.claim_discovery_crawl(uuid) to service_role;
