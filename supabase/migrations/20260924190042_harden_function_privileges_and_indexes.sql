-- Pin function name resolution so SECURITY DEFINER functions cannot resolve
-- attacker-controlled objects from a mutable schema.
alter function public.set_updated_at() set search_path = '';
alter function public.handle_new_user() set search_path = '';
alter function public.create_organization_with_owner(text, text, text[], text) set search_path = '';
alter function public.is_organization_member(uuid) set search_path = '';
alter function public.is_organization_admin(uuid) set search_path = '';
alter function public.is_meeting_participant(uuid) set search_path = '';
alter function public.audit_source_rights() set search_path = '';

-- Trigger functions are not public APIs. PostgreSQL does not require callers
-- to hold EXECUTE on a trigger function when the trigger fires.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.audit_source_rights() from public, anon, authenticated;

-- User-facing helper RPCs remain available only to signed-in users and the
-- server role. Revoking PUBLIC also removes implicit access inherited by anon.
revoke execute on function public.create_organization_with_owner(text, text, text[], text) from public, anon;
revoke execute on function public.is_organization_member(uuid) from public, anon;
revoke execute on function public.is_organization_admin(uuid) from public, anon;
revoke execute on function public.is_meeting_participant(uuid) from public, anon;

grant execute on function public.create_organization_with_owner(text, text, text[], text) to authenticated, service_role;
grant execute on function public.is_organization_member(uuid) to authenticated, service_role;
grant execute on function public.is_organization_admin(uuid) to authenticated, service_role;
grant execute on function public.is_meeting_participant(uuid) to authenticated, service_role;

-- This is byte-for-byte equivalent to procurement_opportunities_status_deadline_idx.
drop index if exists public.procurement_opportunities_deadline_status_idx;
