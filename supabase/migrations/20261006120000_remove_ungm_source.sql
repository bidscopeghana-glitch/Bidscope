-- UNGM declined private-entity API access and requires prior written permission
-- to republish site material. Retire this source and its unpublished imports.
-- Keep a minimal compliance audit; do not cascade-delete customer AI threads.
do $$
declare
  source_record public.procurement_sources%rowtype;
  notice_count integer;
  detached_threads integer;
  deleted_notices integer;
  deleted_sources integer;
begin
  select * into source_record
  from public.procurement_sources
  where slug = 'ungm'
  for update;

  if not found then
    if exists (
      select 1 from public.procurement_opportunities
      where source_name ilike '%UNGM%'
         or source_name ilike '%United Nations Global Marketplace%'
         or official_source_url ~* '^https://(www\.)?ungm\.org/'
    ) then
      raise exception 'UNGM notices remain without a source row';
    end if;
    return;
  end if;

  if source_record.status <> 'PAUSED'
     or source_record.sync_enabled
     or source_record.reuse_status <> 'prohibited' then
    raise exception 'UNGM source is not in the reviewed disabled state';
  end if;

  select count(*) into notice_count
  from public.procurement_opportunities
  where source_id = source_record.id;

  -- The production review identified 45 unpublished UNGM notices. Abort if
  -- the target grew or includes records belonging to another publisher.
  if notice_count > 45 or exists (
    select 1 from public.procurement_opportunities
    where source_id = source_record.id
      and (source_name not ilike '%UNGM%'
           and source_name not ilike '%United Nations Global Marketplace%'
           or coalesce(official_source_url, '') !~* '^https://(www\.)?ungm\.org/')
  ) then
    raise exception 'UNGM deletion target differs from reviewed scope';
  end if;

  if exists (
    select 1 from public.procurement_opportunities
    where source_id is distinct from source_record.id
      and (source_name ilike '%UNGM%'
           or source_name ilike '%United Nations Global Marketplace%'
           or official_source_url ~* '^https://(www\.)?ungm\.org/')
  ) then
    raise exception 'UNGM notices exist outside the reviewed source';
  end if;

  update public.ai_threads
  set opportunity_id = null
  where opportunity_id in (
    select id from public.procurement_opportunities
    where source_id = source_record.id
  );
  get diagnostics detached_threads = row_count;

  insert into public.audit_log (action, entity_type, entity_id, metadata)
  values (
    'procurement_source.removed', 'procurement_source', 'ungm',
    jsonb_build_object(
      'source_id', source_record.id,
      'reason', 'UNGM denied private-entity API access and requires prior written permission for republication',
      'removed_notice_count', notice_count,
      'detached_ai_thread_count', detached_threads,
      'rights_history', coalesce((
        select jsonb_agg(to_jsonb(a) order by a.id)
        from public.source_rights_audit a
        where a.source_id = source_record.id
      ), '[]'::jsonb),
      'removed_sync_run_count', (
        select count(*) from public.source_sync_runs
        where source_id = source_record.id
      )
    )
  );

  delete from public.procurement_opportunities
  where source_id = source_record.id;
  get diagnostics deleted_notices = row_count;
  if deleted_notices <> notice_count then
    raise exception 'UNGM notice deletion count changed during retirement';
  end if;

  delete from public.procurement_sources
  where id = source_record.id and slug = 'ungm';
  get diagnostics deleted_sources = row_count;
  if deleted_sources <> 1 then
    raise exception 'UNGM source deletion did not affect exactly one row';
  end if;
end $$;
