-- Production audit correction: the Bank of Ghana WordPress endpoint is not
-- dependably reachable. Preserve imported records, but never represent the
-- connector as live until a stable official endpoint is verified.
update public.procurement_sources
set integration_type='MANUAL',
    implementation_status='UNAVAILABLE',
    api_enabled=false,
    sync_enabled=false,
    status='UNAVAILABLE',
    access_classification='RESEARCH_REQUIRED',
    last_health_at=now(),
    last_health_message='Official website endpoint was not dependably reachable during the production audit.',
    last_error='Official endpoint unavailable; existing records preserved.',
    coverage_notes='Existing official-source records are preserved. Automated sync remains disabled until a stable, permitted official endpoint is verified.',
    configuration=coalesce(configuration,'{}'::jsonb)||'{"production_audit":"endpoint unavailable; do not present as live"}'::jsonb
where slug='bank-of-ghana';

insert into public.procurement_source_alerts(source_id,severity,alert_type,message,details)
select id,'WARNING','SOURCE_UNAVAILABLE','Bank of Ghana automated sync was disabled after repeated endpoint timeouts. Existing records were preserved.',
       '{"action_required":"Verify a stable, permitted official endpoint before re-enabling sync."}'::jsonb
from public.procurement_sources s
where s.slug='bank-of-ghana'
  and not exists(select 1 from public.procurement_source_alerts a where a.source_id=s.id and a.alert_type='SOURCE_UNAVAILABLE' and a.resolved_at is null);

create unique index if not exists procurement_source_alerts_run_type_unique
on public.procurement_source_alerts(sync_run_id,alert_type)
where sync_run_id is not null;
