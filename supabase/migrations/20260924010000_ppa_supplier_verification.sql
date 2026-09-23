-- PPA checks are manual official-source evidence until PPA publishes a supported public API/feed.
alter table public.supplier_verification_settings
  add column if not exists ppa_recheck_months integer not null default 12 check (ppa_recheck_months between 1 and 24),
  add column if not exists ppa_supplier_url text not null default 'https://ppa.gov.gh/suppliers/',
  add column if not exists ppa_portal_url text not null default 'https://suppliers.ppa.gov.gh/',
  add column if not exists ppa_barred_url text not null default 'https://ppa.gov.gh/suppliers/barred-suppliers/';

alter table public.supplier_verification_checks
  add column if not exists result_code text check (result_code is null or result_code in ('registered','not_found','needs_review','expired','inactive','unavailable','clear','possible_match','barred','source_unavailable')),
  add column if not exists match_confidence numeric(5,4) check (match_confidence is null or match_confidence between 0 and 1),
  add column if not exists checked_company_name text,
  add column if not exists checked_registration_number text,
  add column if not exists checked_at timestamptz,
  add column if not exists next_check_at timestamptz;

create index if not exists supplier_verification_ppa_recheck
  on public.supplier_verification_checks(next_check_at)
  where check_type in ('ppa_supplier_registration','ppa_barred_supplier') and next_check_at is not null;

-- Existing open reviews gain PPA checks without promoting or rejecting any supplier.
insert into public.supplier_verification_checks(request_id,check_type,status,source,notes)
select r.id,check_type,'pending','PPA Ghana','Manual official-source review required; no supported public supplier-search API was identified.'
from public.supplier_verification_requests r
cross join (values ('ppa_supplier_registration'),('ppa_barred_supplier')) as checks(check_type)
where r.status in ('draft','awaiting_payment','paid','submitted','under_review','information_required')
on conflict(request_id,check_type) do nothing;

create or replace function public.decide_supplier_verification(
  p_request_id uuid,p_actor_id uuid,p_decision text,p_reason text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare item public.supplier_verification_requests; months integer; missing_count integer; expiry timestamptz; expected_count integer;
begin
  if p_decision not in ('approve','reject','request_information','start_review') then raise exception 'Invalid decision'; end if;
  select * into item from public.supplier_verification_requests where id=p_request_id for update;
  if not found then raise exception 'Application not found'; end if;
  if item.status not in ('submitted','under_review','information_required') then raise exception 'Application is not reviewable'; end if;
  if p_decision='approve' then
    if item.requested_level='enhanced_verified' and item.payment_status<>'paid' then raise exception 'Payment not confirmed'; end if;
    expected_count:=case when item.requested_level='verified' then 7 else 12 end;
    select count(*) into missing_count from public.supplier_verification_checks c where c.request_id=p_request_id
      and (c.status not in ('passed','not_applicable') or
           (c.check_type in ('company_registration','company_name_match','registration_number_match','document_integrity','manual_review') and c.status<>'passed'));
    if missing_count>0 or (select count(*) from public.supplier_verification_checks c where c.request_id=p_request_id)<expected_count
      or not exists(select 1 from public.supplier_verification_documents d where d.request_id=p_request_id) then raise exception 'Required evidence or checks incomplete'; end if;
    select validity_months into months from public.supplier_verification_settings where id=true;
    expiry:=now()+make_interval(months=>coalesce(months,12));
    update public.supplier_verification_requests set status='approved',reviewed_by=p_actor_id,reviewed_at=now(),decision_reason=p_reason,expiry_date=expiry,updated_at=now() where id=p_request_id;
    insert into public.supplier_verification_status(organization_id,level,verified_at,expires_at,source_request_id)
      values(item.organization_id,item.requested_level,now(),expiry,p_request_id)
      on conflict(organization_id) do update set level=excluded.level,verified_at=excluded.verified_at,expires_at=excluded.expires_at,source_request_id=excluded.source_request_id,updated_at=now();
  else
    update public.supplier_verification_requests set status=case p_decision when 'reject' then 'rejected' when 'request_information' then 'information_required' else 'under_review' end,
      reviewed_by=p_actor_id,reviewed_at=case when p_decision='start_review' then reviewed_at else now() end,
      decision_reason=p_reason,updated_at=now() where id=p_request_id;
  end if;
  insert into public.supplier_verification_audit_log(request_id,organization_id,actor_id,action,details)
    values(p_request_id,item.organization_id,p_actor_id,p_decision,jsonb_build_object('reason',p_reason,'previous_status',item.status));
  return jsonb_build_object('decision',p_decision,'expires_at',expiry);
end $$;
revoke all on function public.decide_supplier_verification(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.decide_supplier_verification(uuid,uuid,text,text) to service_role;
