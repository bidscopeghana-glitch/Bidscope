-- Reversible retirement. Does not delete catalogue or tender records.
begin;
alter table public.bidscope_catalogue_drafts rename to bidscope_catalogue_drafts_archive_v1;
revoke all on public.bidscope_catalogue_drafts_archive_v1 from public,anon,authenticated,service_role;
commit;
-- Restore only after review: rename back and regrant select,insert,update to service_role.
