-- Supplier verification is distinct from account, buyer and subscription status.
create table if not exists public.supplier_verification_settings (
  id boolean primary key default true check (id),
  enhanced_price_minor bigint not null default 50000 check (enhanced_price_minor >= 0),
  currency text not null default 'GHS' check (currency = 'GHS'),
  validity_months integer not null default 12 check (validity_months between 1 and 60),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.supplier_verification_settings(id) values (true) on conflict do nothing;

create table if not exists public.supplier_verification_status (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  level text not null default 'basic' check (level in ('basic','verified','enhanced_verified')),
  verified_at timestamptz,
  expires_at timestamptz,
  source_request_id uuid,
  updated_at timestamptz not null default now(),
  check ((level = 'basic' and verified_at is null and expires_at is null) or
         (level <> 'basic' and verified_at is not null and expires_at is not null))
);
-- Preserve every existing supplier as Basic; no historical profile is promoted.
insert into public.supplier_verification_status(organization_id,level)
select id,'basic' from public.organizations where can_bid=true
on conflict(organization_id) do nothing;

create table if not exists public.supplier_verification_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_level text not null check (requested_level in ('verified','enhanced_verified')),
  status text not null default 'draft' check (status in ('draft','awaiting_payment','paid','submitted','under_review','information_required','approved','rejected','expired','cancelled')),
  submitted_by uuid not null references auth.users(id),
  submitted_at timestamptz,
  reviewed_by uuid references auth.users(id),
  assigned_to uuid references auth.users(id),
  reviewed_at timestamptz,
  decision_reason text,
  payment_reference text unique,
  payment_status text not null default 'not_required' check (payment_status in ('not_required','pending','paid','failed','refunded','cancelled')),
  amount_minor bigint not null default 0,
  currency text not null default 'GHS',
  payment_date timestamptz,
  provider_transaction_id text,
  refund_status text not null default 'not_requested' check (refund_status in ('not_requested','under_review','approved','denied','processed')),
  eligible_for_refund boolean,
  refund_reason text,
  risk_level text not null default 'unknown' check (risk_level in ('unknown','low','medium','high')),
  expiry_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requested_level <> 'enhanced_verified' or amount_minor >= 0)
);
create unique index if not exists supplier_verification_one_open_request on public.supplier_verification_requests(organization_id,requested_level)
  where status in ('draft','awaiting_payment','paid','submitted','under_review','information_required');
create index if not exists supplier_verification_requests_queue on public.supplier_verification_requests(status,created_at);
create index if not exists supplier_verification_status_expiry on public.supplier_verification_status(expires_at) where expires_at is not null;
alter table public.procurement_tenders add column if not exists supplier_verification_requirement text not null default 'any'
  check (supplier_verification_requirement in ('any','verified','enhanced_verified'));
alter table public.supplier_verification_status add constraint supplier_verification_status_request_fk foreign key(source_request_id) references public.supplier_verification_requests(id) on delete set null;

create table if not exists public.supplier_verification_checks (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.supplier_verification_requests(id) on delete cascade,
  check_type text not null,
  status text not null default 'pending' check (status in ('pending','passed','failed','needs_review','not_applicable')),
  source text,
  evidence_reference text,
  notes text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  automated boolean not null default false,
  created_at timestamptz not null default now(),
  unique(request_id,check_type)
);

create table if not exists public.supplier_verification_documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.supplier_verification_requests(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_type text not null,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 4194304),
  storage_path text not null unique,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  risk_level text not null default 'unknown' check (risk_level in ('unknown','low','medium','high')),
  integrity_flags text[] not null default '{}',
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists supplier_verification_documents_hash on public.supplier_verification_documents(sha256);
create index if not exists supplier_verification_documents_request on public.supplier_verification_documents(request_id,created_at desc);

create table if not exists public.supplier_verification_audit_log (
  id bigint generated always as identity primary key,
  request_id uuid references public.supplier_verification_requests(id) on delete set null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists supplier_verification_audit_org on public.supplier_verification_audit_log(organization_id,created_at desc);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('supplier-verification-private','supplier-verification-private',false,4194304,
  array['application/pdf','image/png','image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- No authenticated write policy: suppliers cannot set their own status, checks or payment.
alter table public.supplier_verification_settings enable row level security;
alter table public.supplier_verification_status enable row level security;
alter table public.supplier_verification_requests enable row level security;
alter table public.supplier_verification_checks enable row level security;
alter table public.supplier_verification_documents enable row level security;
alter table public.supplier_verification_audit_log enable row level security;
create policy supplier_verification_settings_read on public.supplier_verification_settings for select to authenticated using (true);
create policy supplier_verification_status_read on public.supplier_verification_status for select to authenticated using (true);
create policy supplier_verification_requests_read on public.supplier_verification_requests for select to authenticated using (public.is_organization_member(organization_id));
create policy supplier_verification_checks_read on public.supplier_verification_checks for select to authenticated using (exists(select 1 from public.supplier_verification_requests r where r.id=request_id and public.is_organization_member(r.organization_id)));
create policy supplier_verification_documents_read on public.supplier_verification_documents for select to authenticated using (public.is_organization_member(organization_id));
create policy supplier_verification_audit_read on public.supplier_verification_audit_log for select to authenticated using (public.is_organization_member(organization_id));
grant select on public.supplier_verification_settings,public.supplier_verification_status,public.supplier_verification_requests,public.supplier_verification_checks,public.supplier_verification_documents,public.supplier_verification_audit_log to authenticated;
revoke all on public.supplier_verification_settings,public.supplier_verification_status,public.supplier_verification_requests,public.supplier_verification_checks,public.supplier_verification_documents,public.supplier_verification_audit_log from anon;
revoke insert,update,delete on public.supplier_verification_settings,public.supplier_verification_status,public.supplier_verification_requests,public.supplier_verification_checks,public.supplier_verification_documents,public.supplier_verification_audit_log from anon,authenticated;
grant all on public.supplier_verification_settings,public.supplier_verification_status,public.supplier_verification_requests,public.supplier_verification_checks,public.supplier_verification_documents,public.supplier_verification_audit_log to service_role;

-- Existing supplier document review fields must not be writable through direct RLS.
revoke insert on public.supplier_documents from authenticated;
grant insert(organization_id,uploaded_by,document_type,title,storage_path,source_url,issued_at,expires_at,metadata) on public.supplier_documents to authenticated;
revoke update on public.supplier_documents from authenticated;
grant update(document_type,title,source_url,issued_at,expires_at) on public.supplier_documents to authenticated;

create or replace function public.complete_supplier_verification_payment(
  p_request_id uuid,p_reference text,p_provider_transaction_id text,p_amount_minor bigint,p_currency text,p_paid_at timestamptz
) returns jsonb language plpgsql security definer set search_path=public as $$
declare item public.supplier_verification_requests;
begin
  select * into item from public.supplier_verification_requests where id=p_request_id for update;
  if not found or item.payment_reference is distinct from p_reference or item.requested_level <> 'enhanced_verified'
     or item.amount_minor <> p_amount_minor or item.currency <> p_currency then
    raise exception 'Verification payment does not match the application';
  end if;
  if item.payment_status='paid' then return jsonb_build_object('processed',false,'idempotent',true); end if;
  if item.status <> 'awaiting_payment' or item.payment_status <> 'pending' then raise exception 'Application is not awaiting payment'; end if;
  update public.supplier_verification_requests set payment_status='paid',status='paid',payment_date=p_paid_at,
    provider_transaction_id=p_provider_transaction_id,updated_at=now() where id=p_request_id;
  insert into public.supplier_verification_audit_log(request_id,organization_id,action,details)
    values(p_request_id,item.organization_id,'payment_confirmed',jsonb_build_object('reference',p_reference,'amount_minor',p_amount_minor,'currency',p_currency));
  return jsonb_build_object('processed',true,'idempotent',false);
end $$;
revoke all on function public.complete_supplier_verification_payment(uuid,text,text,bigint,text,timestamptz) from public,anon,authenticated;
grant execute on function public.complete_supplier_verification_payment(uuid,text,text,bigint,text,timestamptz) to service_role;

create or replace function public.decide_supplier_verification(
  p_request_id uuid,p_actor_id uuid,p_decision text,p_reason text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare item public.supplier_verification_requests; months integer; missing_count integer; expiry timestamptz;
begin
  if p_decision not in ('approve','reject','request_information','start_review') then raise exception 'Invalid decision'; end if;
  select * into item from public.supplier_verification_requests where id=p_request_id for update;
  if not found then raise exception 'Application not found'; end if;
  if item.status not in ('submitted','under_review','information_required') then raise exception 'Application is not reviewable'; end if;
  if p_decision='approve' then
    if item.requested_level='enhanced_verified' and item.payment_status<>'paid' then raise exception 'Payment not confirmed'; end if;
    select count(*) into missing_count from public.supplier_verification_checks c where c.request_id=p_request_id
      and (c.status not in ('passed','not_applicable') or
           (c.check_type in ('company_registration','company_name_match','registration_number_match','document_integrity','manual_review') and c.status<>'passed'));
    if missing_count>0 or (select count(*) from public.supplier_verification_checks c where c.request_id=p_request_id)<(case when item.requested_level='verified' then 5 else 10 end)
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
