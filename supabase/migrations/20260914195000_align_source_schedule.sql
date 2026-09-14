-- Vercel currently runs the consolidated procurement job once daily at 06:00 UTC.
-- Keep registry claims aligned with the schedule actually deployed.
update public.procurement_sources
set sync_frequency='daily'
where sync_enabled=true and implementation_status='LIVE';

-- Recover jobs that were interrupted before their terminal state was written.
update public.source_sync_runs
set status='FAILED',
    completed_at=coalesce(completed_at, now()),
    error_summary=coalesce(error_summary, 'Stale running sync recovered by production audit')
where status='RUNNING'
  and started_at < now() - interval '30 minutes';

-- Stored statuses remain useful for indexing and reporting; refresh them now.
select public.refresh_procurement_opportunity_statuses();
