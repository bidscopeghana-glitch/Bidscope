begin;

alter table public.organizations add column if not exists can_bid boolean not null default true;
alter table public.organizations add column if not exists can_procure boolean not null default false;
alter table public.organizations add column if not exists organization_type text;
alter table public.organizations add column if not exists procurement_contact text;
alter table public.organizations add column if not exists company_email text;
alter table public.organizations add column if not exists expected_procurement_categories text[] not null default '{}';

alter table public.organization_members add column if not exists procurement_role text not null default 'bid_team_member';
alter table public.organization_members drop constraint if exists organization_members_procurement_role_check;
alter table public.organization_members add constraint organization_members_procurement_role_check check (procurement_role in (
  'organization_owner','procurement_manager','procurement_officer','evaluator','technical_expert','finance_evaluator','approver','viewer','bid_team_member'
));

create table if not exists public.buyer_verifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  organization_name text not null,
  registration_number text not null,
  official_company_email text not null,
  contact_person text not null,
  organization_type text,
  document_paths text[] not null default '{}',
  status text not null default 'unverified' check (status in ('unverified','pending','verified','rejected','suspended')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  verification_notes text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.procurement_tenders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (length(title) between 5 and 300),
  reference_number text,
  description text not null default '',
  tender_type text not null check (tender_type in ('rfq','rfp','eoi','itt','prequalification','other')),
  procurement_category text not null,
  classification text not null check (classification in ('goods','services','works','consulting','other')),
  location text,
  currency text not null default 'GHS' check (length(currency)=3),
  estimated_budget numeric(18,2) check (estimated_budget is null or estimated_budget >= 0),
  issue_date timestamptz,
  clarification_deadline timestamptz,
  submission_deadline timestamptz not null,
  expected_award_date date,
  expected_contract_start_date date,
  eligibility_requirements text not null default '',
  technical_requirements text not null default '',
  commercial_requirements text not null default '',
  delivery_requirements text not null default '',
  terms_and_conditions text not null default '',
  procurement_owner_name text,
  procurement_owner_email text,
  award_structure text not null default 'single' check (award_structure in ('single','multiple','lots')),
  bid_opening_model text not null default 'sealed' check (bid_opening_model in ('sealed','open_as_received')),
  visibility text not null default 'open' check (visibility in ('open','invite_only','open_preferred')),
  questions_allowed boolean not null default true,
  supplier_identity_visible_before_opening boolean not null default false,
  withdrawal_allowed boolean not null default true,
  approval_required boolean not null default false,
  publish_award_publicly boolean not null default false,
  status text not null default 'draft' check (status in ('draft','pending_verification','scheduled','live','closing_soon','closed','evaluation','shortlisted','interviews','pending_award','awarded','cancelled','archived','suspended')),
  published_at timestamptz,
  bids_opened_at timestamptz,
  bids_opened_by uuid references auth.users(id) on delete set null,
  cancellation_reason text,
  featured boolean not null default false,
  billing_metadata jsonb not null default '{"listing":"free"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (clarification_deadline is null or clarification_deadline <= submission_deadline)
);
create unique index if not exists procurement_tenders_org_reference_idx on public.procurement_tenders(organization_id,lower(reference_number)) where reference_number is not null;
create index if not exists procurement_tenders_marketplace_idx on public.procurement_tenders(status,submission_deadline) where status in ('scheduled','live','closing_soon');
create index if not exists procurement_tenders_org_status_idx on public.procurement_tenders(organization_id,status,updated_at desc);

create table if not exists public.procurement_tender_lots (
  id uuid primary key default gen_random_uuid(), tender_id uuid not null references public.procurement_tenders(id) on delete cascade,
  lot_number text not null, title text not null, description text not null default '', quantity numeric,
  budget numeric(18,2), requirements text not null default '', evaluation_criteria jsonb not null default '[]',
  created_at timestamptz not null default now(), unique(tender_id,lot_number)
);

create table if not exists public.procurement_requirements (
  id uuid primary key default gen_random_uuid(), tender_id uuid not null references public.procurement_tenders(id) on delete cascade,
  section text not null check(section in ('eligibility','technical','commercial','delivery','other')),
  title text not null, description text not null default '', mandatory boolean not null default true,
  display_order integer not null default 0, created_at timestamptz not null default now()
);

create table if not exists public.procurement_required_documents (
  id uuid primary key default gen_random_uuid(), tender_id uuid not null references public.procurement_tenders(id) on delete cascade,
  name text not null, description text not null default '', mandatory boolean not null default true,
  accepted_mime_types text[] not null default '{}', display_order integer not null default 0, created_at timestamptz not null default now()
);

create table if not exists public.procurement_tender_documents (
  id uuid primary key default gen_random_uuid(), tender_id uuid not null references public.procurement_tenders(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete restrict, storage_path text not null unique,
  original_filename text not null, mime_type text not null, size_bytes bigint not null check(size_bytes between 1 and 26214400),
  visibility text not null default 'eligible_suppliers' check(visibility in ('buyer_team','eligible_suppliers','bidders')),
  created_at timestamptz not null default now()
);

create table if not exists public.procurement_evaluation_criteria (
  id uuid primary key default gen_random_uuid(), tender_id uuid not null references public.procurement_tenders(id) on delete cascade,
  lot_id uuid references public.procurement_tender_lots(id) on delete cascade, name text not null, description text not null default '',
  criterion_type text not null default 'scored' check(criterion_type in ('scored','pass_fail','text')),
  weight numeric(6,3) check(weight is null or weight between 0 and 100), score_min numeric not null default 0,
  score_max numeric not null default 10 check(score_max > score_min), guidance text not null default '', mandatory boolean not null default false,
  section text not null default 'general' check(section in ('general','technical','commercial','experience','delivery','compliance')),
  display_order integer not null default 0, created_at timestamptz not null default now()
);

create table if not exists public.tender_invitations (
  id uuid primary key default gen_random_uuid(), tender_id uuid not null references public.procurement_tenders(id) on delete cascade,
  supplier_organization_id uuid not null references public.organizations(id) on delete cascade, invited_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'invited' check(status in ('invited','viewed','accepted','declined','submitted','revoked')),
  invited_at timestamptz not null default now(), responded_at timestamptz, unique(tender_id,supplier_organization_id)
);

create table if not exists public.supplier_bids (
  id uuid primary key default gen_random_uuid(), tender_id uuid not null references public.procurement_tenders(id) on delete restrict,
  supplier_organization_id uuid not null references public.organizations(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict, current_version integer not null default 1,
  status text not null default 'draft' check(status in ('draft','submitted','withdrawn','clarification_requested','under_review','shortlisted','interview_requested','interview_scheduled','unsuccessful','awarded')),
  bid_price numeric(18,2) check(bid_price is null or bid_price >= 0), currency text not null default 'GHS' check(length(currency)=3),
  price_breakdown jsonb not null default '[]', delivery_period text, bid_validity_days integer check(bid_validity_days is null or bid_validity_days between 1 and 730),
  technical_response text not null default '', methodology_response text not null default '', experience_response text not null default '',
  compliance_declarations jsonb not null default '{}', notes text not null default '',
  submitted_at timestamptz, withdrawn_at timestamptz, withdrawn_by uuid references auth.users(id) on delete set null, withdrawal_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(tender_id,supplier_organization_id)
);
create index if not exists supplier_bids_tender_status_idx on public.supplier_bids(tender_id,status,submitted_at desc);
create index if not exists supplier_bids_supplier_idx on public.supplier_bids(supplier_organization_id,updated_at desc);

create table if not exists public.supplier_bid_versions (
  id uuid primary key default gen_random_uuid(), bid_id uuid not null references public.supplier_bids(id) on delete cascade,
  version_number integer not null, snapshot jsonb not null, submitted_by uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz not null default now(), unique(bid_id,version_number)
);
create table if not exists public.supplier_bid_lots (
  bid_id uuid not null references public.supplier_bids(id) on delete cascade, lot_id uuid not null references public.procurement_tender_lots(id) on delete cascade,
  price numeric(18,2) check(price is null or price >= 0), currency text not null default 'GHS', response text not null default '',
  primary key(bid_id,lot_id)
);
create table if not exists public.supplier_bid_responses (
  id uuid primary key default gen_random_uuid(), bid_id uuid not null references public.supplier_bids(id) on delete cascade,
  requirement_id uuid references public.procurement_requirements(id) on delete cascade, criterion_id uuid references public.procurement_evaluation_criteria(id) on delete cascade,
  response_text text not null default '', declaration boolean, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(requirement_id is not null or criterion_id is not null)
);
create table if not exists public.supplier_bid_documents (
  id uuid primary key default gen_random_uuid(), bid_id uuid not null references public.supplier_bids(id) on delete cascade,
  required_document_id uuid references public.procurement_required_documents(id) on delete set null, uploaded_by uuid not null references auth.users(id) on delete restrict,
  storage_path text not null unique, original_filename text not null, mime_type text not null, size_bytes bigint not null check(size_bytes between 1 and 26214400),
  created_at timestamptz not null default now()
);

create table if not exists public.tender_clarifications (
  id uuid primary key default gen_random_uuid(), tender_id uuid not null references public.procurement_tenders(id) on delete cascade,
  bid_id uuid references public.supplier_bids(id) on delete cascade, requester_user_id uuid not null references auth.users(id) on delete restrict,
  requester_organization_id uuid not null references public.organizations(id) on delete restrict,
  recipient_organization_id uuid references public.organizations(id) on delete restrict,
  visibility text not null default 'private' check(visibility in ('private','all_participants','public')),
  kind text not null default 'supplier_question' check(kind in ('supplier_question','buyer_clarification','buyer_response')),
  subject text not null, message text not null, response_to_id uuid references public.tender_clarifications(id) on delete set null,
  response_deadline timestamptz, status text not null default 'open' check(status in ('open','answered','closed','overdue')),
  attachment_paths text[] not null default '{}', created_at timestamptz not null default now(), answered_at timestamptz
);

create table if not exists public.procurement_evaluation_assignments (
  id uuid primary key default gen_random_uuid(), tender_id uuid not null references public.procurement_tenders(id) on delete cascade,
  evaluator_user_id uuid not null references auth.users(id) on delete cascade, bid_id uuid references public.supplier_bids(id) on delete cascade,
  criterion_id uuid references public.procurement_evaluation_criteria(id) on delete cascade, lot_id uuid references public.procurement_tender_lots(id) on delete cascade,
  assignment_role text not null check(assignment_role in ('evaluator','technical_evaluator','commercial_evaluator','approver','auditor')),
  status text not null default 'active' check(status in ('active','completed','revoked')),
  assigned_by uuid not null references auth.users(id) on delete restrict, created_at timestamptz not null default now()
);
create unique index if not exists procurement_eval_assignment_unique on public.procurement_evaluation_assignments(tender_id,evaluator_user_id,coalesce(bid_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(criterion_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(lot_id,'00000000-0000-0000-0000-000000000000'::uuid));

create table if not exists public.bid_evaluations (
  id uuid primary key default gen_random_uuid(), tender_id uuid not null references public.procurement_tenders(id) on delete cascade,
  bid_id uuid not null references public.supplier_bids(id) on delete cascade, evaluator_user_id uuid not null references auth.users(id) on delete cascade,
  lot_id uuid references public.procurement_tender_lots(id) on delete cascade, overall_note text not null default '',
  recommendation text check(recommendation in ('proceed','clarify','shortlist','unsuccessful') or recommendation is null),
  status text not null default 'draft' check(status in ('draft','submitted')), submitted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id)
);
create unique index if not exists bid_evaluations_evaluator_lot_unique on public.bid_evaluations(bid_id,evaluator_user_id,coalesce(lot_id,'00000000-0000-0000-0000-000000000000'::uuid));
create table if not exists public.evaluation_scores (
  evaluation_id uuid not null references public.bid_evaluations(id) on delete cascade,
  criterion_id uuid not null references public.procurement_evaluation_criteria(id) on delete cascade,
  numeric_score numeric, pass boolean, assessment text not null default '', private_note text not null default '',
  primary key(evaluation_id,criterion_id)
);

create table if not exists public.tender_shortlists (
  id uuid primary key default gen_random_uuid(), tender_id uuid not null references public.procurement_tenders(id) on delete cascade,
  bid_id uuid not null references public.supplier_bids(id) on delete cascade, lot_id uuid references public.procurement_tender_lots(id) on delete cascade,
  action text not null check(action in ('shortlist','clarification','interview','unsuccessful','under_review')),
  note text, acted_by uuid not null references auth.users(id) on delete restrict, created_at timestamptz not null default now()
);

create table if not exists public.procurement_awards (
  id uuid primary key default gen_random_uuid(), tender_id uuid not null references public.procurement_tenders(id) on delete restrict,
  supplier_organization_id uuid not null references public.organizations(id) on delete restrict, bid_id uuid not null references public.supplier_bids(id) on delete restrict,
  contract_value numeric(18,2) not null check(contract_value >= 0), currency text not null default 'GHS', award_date date not null,
  expected_start_date date, expected_end_date date, award_notes text not null default '',
  approval_status text not null default 'draft' check(approval_status in ('draft','pending','approved','rejected','finalised')),
  proposed_by uuid not null references auth.users(id) on delete restrict, approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz, finalised_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists procurement_awards_single_supplier_idx on public.procurement_awards(tender_id,supplier_organization_id) where approval_status <> 'rejected';
create table if not exists public.procurement_award_lots (
  award_id uuid not null references public.procurement_awards(id) on delete cascade, lot_id uuid not null references public.procurement_tender_lots(id) on delete restrict,
  awarded_value numeric(18,2), primary key(award_id,lot_id)
);

create table if not exists public.procurement_audit_logs (
  id bigint generated always as identity primary key, organization_id uuid not null references public.organizations(id) on delete restrict,
  tender_id uuid references public.procurement_tenders(id) on delete set null, actor_user_id uuid references auth.users(id) on delete set null,
  action text not null, entity_type text not null, entity_id uuid, before_data jsonb, after_data jsonb, metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists procurement_audit_tender_idx on public.procurement_audit_logs(tender_id,created_at desc);

alter table public.meetings add column if not exists procurement_tender_id uuid references public.procurement_tenders(id) on delete set null;
alter table public.meetings add column if not exists supplier_bid_id uuid references public.supplier_bids(id) on delete set null;
alter table public.meetings add column if not exists supplier_organization_id uuid references public.organizations(id) on delete set null;
alter table public.meetings add column if not exists tender_lot_id uuid references public.procurement_tender_lots(id) on delete set null;
alter table public.meetings add column if not exists procurement_meeting_type text check(procurement_meeting_type in ('supplier_interview','supplier_presentation','clarification','negotiation','evaluation_committee'));
alter table public.meetings add column if not exists interview_questions jsonb not null default '[]';
alter table public.meetings add column if not exists private_assessment text;
alter table public.meetings add column if not exists procurement_next_step text check(procurement_next_step in ('proceed','further_clarification','keep_shortlisted','unsuccessful') or procurement_next_step is null);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('procurement-private','procurement-private',false,26214400,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/png','image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.procurement_role_for(p_organization_id uuid)
returns text language sql stable security definer set search_path=public as $$
  select case when om.role='owner' then 'organization_owner' else om.procurement_role end
  from public.organization_members om where om.organization_id=p_organization_id and om.user_id=auth.uid() limit 1;
$$;
create or replace function public.can_manage_procurement(p_organization_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(public.procurement_role_for(p_organization_id) in ('organization_owner','procurement_manager','procurement_officer'),false);
$$;
create or replace function public.can_evaluate_tender(p_tender_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.procurement_evaluation_assignments a where a.tender_id=p_tender_id and a.evaluator_user_id=auth.uid());
$$;
create or replace function public.can_view_bid(p_bid_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.supplier_bids b join public.procurement_tenders t on t.id=b.tender_id
    where b.id=p_bid_id and (
      public.is_organization_member(b.supplier_organization_id)
      or ((public.can_manage_procurement(t.organization_id) or public.can_evaluate_tender(t.id)) and (t.bid_opening_model='open_as_received' or now()>=t.submission_deadline or t.bids_opened_at is not null))
    )
  );
$$;

alter table public.buyer_verifications enable row level security;
alter table public.procurement_tenders enable row level security;
alter table public.procurement_tender_lots enable row level security;
alter table public.procurement_requirements enable row level security;
alter table public.procurement_required_documents enable row level security;
alter table public.procurement_tender_documents enable row level security;
alter table public.procurement_evaluation_criteria enable row level security;
alter table public.tender_invitations enable row level security;
alter table public.supplier_bids enable row level security;
alter table public.supplier_bid_versions enable row level security;
alter table public.supplier_bid_lots enable row level security;
alter table public.supplier_bid_responses enable row level security;
alter table public.supplier_bid_documents enable row level security;
alter table public.tender_clarifications enable row level security;
alter table public.procurement_evaluation_assignments enable row level security;
alter table public.bid_evaluations enable row level security;
alter table public.evaluation_scores enable row level security;
alter table public.tender_shortlists enable row level security;
alter table public.procurement_awards enable row level security;
alter table public.procurement_award_lots enable row level security;
alter table public.procurement_audit_logs enable row level security;

create policy buyer_verification_member_read on public.buyer_verifications for select to authenticated using(public.is_organization_member(organization_id));
create policy procurement_tenders_market_read on public.procurement_tenders for select to authenticated using(status in ('scheduled','live','closing_soon','closed','evaluation','shortlisted','interviews','pending_award','awarded') or public.is_organization_member(organization_id));
create policy procurement_tenders_manager_write on public.procurement_tenders for all to authenticated using(public.can_manage_procurement(organization_id)) with check(public.can_manage_procurement(organization_id));
create policy procurement_tender_lots_read on public.procurement_tender_lots for select to authenticated using(exists(select 1 from public.procurement_tenders t where t.id=tender_id and (t.status not in ('draft','pending_verification') or public.is_organization_member(t.organization_id))));
create policy procurement_requirements_read on public.procurement_requirements for select to authenticated using(exists(select 1 from public.procurement_tenders t where t.id=tender_id and (t.status not in ('draft','pending_verification') or public.is_organization_member(t.organization_id))));
create policy procurement_required_documents_read on public.procurement_required_documents for select to authenticated using(exists(select 1 from public.procurement_tenders t where t.id=tender_id and (t.status not in ('draft','pending_verification') or public.is_organization_member(t.organization_id))));
create policy procurement_criteria_read on public.procurement_evaluation_criteria for select to authenticated using(exists(select 1 from public.procurement_tenders t where t.id=tender_id and (t.status not in ('draft','pending_verification') or public.is_organization_member(t.organization_id))));
create policy supplier_bids_owner_read on public.supplier_bids for select to authenticated using(public.can_view_bid(id));
create policy supplier_bids_supplier_insert on public.supplier_bids for insert to authenticated with check(public.is_organization_member(supplier_organization_id));
create policy supplier_bids_supplier_update on public.supplier_bids for update to authenticated using(public.is_organization_member(supplier_organization_id) and status in ('draft','submitted')) with check(public.is_organization_member(supplier_organization_id));
create policy bid_versions_authorized_read on public.supplier_bid_versions for select to authenticated using(public.can_view_bid(bid_id));
create policy bid_lots_authorized_read on public.supplier_bid_lots for select to authenticated using(public.can_view_bid(bid_id));
create policy bid_responses_authorized_read on public.supplier_bid_responses for select to authenticated using(public.can_view_bid(bid_id));
create policy bid_documents_authorized_read on public.supplier_bid_documents for select to authenticated using(public.can_view_bid(bid_id));
create policy clarifications_party_read on public.tender_clarifications for select to authenticated using(visibility in ('public','all_participants') or public.is_organization_member(requester_organization_id) or (recipient_organization_id is not null and public.is_organization_member(recipient_organization_id)));
create policy evaluation_assignment_self_read on public.procurement_evaluation_assignments for select to authenticated using(evaluator_user_id=auth.uid() or exists(select 1 from public.procurement_tenders t where t.id=tender_id and public.can_manage_procurement(t.organization_id)));
create policy bid_evaluations_owner_read on public.bid_evaluations for select to authenticated using(evaluator_user_id=auth.uid() or exists(select 1 from public.procurement_tenders t where t.id=tender_id and public.can_manage_procurement(t.organization_id)));
create policy evaluation_scores_owner_read on public.evaluation_scores for select to authenticated using(exists(select 1 from public.bid_evaluations e where e.id=evaluation_id and (e.evaluator_user_id=auth.uid() or exists(select 1 from public.procurement_tenders t where t.id=e.tender_id and public.can_manage_procurement(t.organization_id)))));
create policy awards_party_read on public.procurement_awards for select to authenticated using(public.is_organization_member(supplier_organization_id) or exists(select 1 from public.procurement_tenders t where t.id=tender_id and public.is_organization_member(t.organization_id)));
create policy procurement_audit_manager_read on public.procurement_audit_logs for select to authenticated using(public.can_manage_procurement(organization_id));

revoke all on public.buyer_verifications,public.procurement_tenders,public.procurement_tender_lots,public.procurement_requirements,public.procurement_required_documents,public.procurement_tender_documents,public.procurement_evaluation_criteria,public.tender_invitations,public.supplier_bids,public.supplier_bid_versions,public.supplier_bid_lots,public.supplier_bid_responses,public.supplier_bid_documents,public.tender_clarifications,public.procurement_evaluation_assignments,public.bid_evaluations,public.evaluation_scores,public.tender_shortlists,public.procurement_awards,public.procurement_award_lots,public.procurement_audit_logs from anon;
grant select,insert,update on public.procurement_tenders,public.supplier_bids to authenticated;
grant select on public.buyer_verifications,public.procurement_tender_lots,public.procurement_requirements,public.procurement_required_documents,public.procurement_evaluation_criteria,public.supplier_bid_versions,public.supplier_bid_lots,public.supplier_bid_responses,public.supplier_bid_documents,public.tender_clarifications,public.procurement_evaluation_assignments,public.bid_evaluations,public.evaluation_scores,public.procurement_awards,public.procurement_audit_logs to authenticated;
grant all on public.buyer_verifications,public.procurement_tenders,public.procurement_tender_lots,public.procurement_requirements,public.procurement_required_documents,public.procurement_tender_documents,public.procurement_evaluation_criteria,public.tender_invitations,public.supplier_bids,public.supplier_bid_versions,public.supplier_bid_lots,public.supplier_bid_responses,public.supplier_bid_documents,public.tender_clarifications,public.procurement_evaluation_assignments,public.bid_evaluations,public.evaluation_scores,public.tender_shortlists,public.procurement_awards,public.procurement_award_lots,public.procurement_audit_logs to service_role;
grant execute on function public.procurement_role_for(uuid),public.can_manage_procurement(uuid),public.can_evaluate_tender(uuid),public.can_view_bid(uuid) to authenticated,service_role;

drop trigger if exists buyer_verifications_set_updated_at on public.buyer_verifications;
create trigger buyer_verifications_set_updated_at before update on public.buyer_verifications for each row execute function public.set_updated_at();
drop trigger if exists procurement_tenders_set_updated_at on public.procurement_tenders;
create trigger procurement_tenders_set_updated_at before update on public.procurement_tenders for each row execute function public.set_updated_at();
drop trigger if exists supplier_bids_set_updated_at on public.supplier_bids;
create trigger supplier_bids_set_updated_at before update on public.supplier_bids for each row execute function public.set_updated_at();
drop trigger if exists bid_evaluations_set_updated_at on public.bid_evaluations;
create trigger bid_evaluations_set_updated_at before update on public.bid_evaluations for each row execute function public.set_updated_at();
drop trigger if exists procurement_awards_set_updated_at on public.procurement_awards;
create trigger procurement_awards_set_updated_at before update on public.procurement_awards for each row execute function public.set_updated_at();

commit;
