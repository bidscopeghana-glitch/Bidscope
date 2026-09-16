-- BidScope Outreach: private prospect CRM, staged imports and controlled campaigns.
-- Sending is deliberately impossible until a campaign is approved and separately started.

create extension if not exists pgcrypto;

create table if not exists public.prospect_imports (
  id uuid primary key default gen_random_uuid(),
  original_filename text not null,
  storage_path text,
  file_hash text not null,
  file_size_bytes bigint not null default 0,
  file_type text not null check (file_type in ('csv','xlsx','xls')),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'uploaded' check (status in ('uploaded','analysing','mapping_required','approved','processing','complete','failed','cancelled')),
  stage text not null default 'uploading' check (stage in ('uploading','reading','cleaning','deduplicating','classifying','scoring','awaiting_approval','importing','complete','failed')),
  detected_columns jsonb not null default '[]'::jsonb,
  column_mapping jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  total_rows integer not null default 0,
  accepted_rows integer not null default 0,
  rejected_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  processed_rows integer not null default 0,
  warning_message text,
  error_message text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  normalized_company_name text not null,
  first_name text,
  last_name text,
  contact_name text,
  contact_role text,
  email text,
  normalized_email text,
  phone text,
  website text,
  linkedin_url text,
  company_address text,
  city text,
  region text,
  country text,
  country_code text,
  postcode text,
  industry text,
  secondary_industry text,
  sub_industry text,
  company_type text,
  procurement_category text,
  company_size text,
  estimated_company_size text,
  tender_activity_count integer not null default 0,
  award_count integer not null default 0,
  estimated_contract_value numeric,
  last_procurement_activity timestamptz,
  source text,
  source_file_id uuid references public.prospect_imports(id) on delete set null,
  source_row_number integer,
  source_url text,
  raw_source_data jsonb not null default '{}'::jsonb,
  classification_confidence numeric not null default 0 check (classification_confidence between 0 and 1),
  classification_method text,
  classification_signature text,
  bidscope_fit_score integer not null default 0 check (bidscope_fit_score between 0 and 100),
  priority text not null default 'Low' check (priority in ('Hot','High','Medium','Low')),
  lifecycle_stage text not null default 'New' check (lifecycle_stage in ('New','Qualified','Contacted','Engaged','Registered','Activated','Customer','Dormant','Unsubscribed','Disqualified')),
  outreach_status text not null default 'eligible',
  lead_status text,
  owner uuid references auth.users(id) on delete set null,
  tags text[] not null default '{}',
  notes text,
  first_contacted_at timestamptz,
  last_contacted_at timestamptz,
  next_contact_at timestamptz,
  registered_user_id uuid references auth.users(id) on delete set null,
  converted_at timestamptz,
  customer_status text,
  unsubscribed_at timestamptz,
  bounced_at timestamptz,
  do_not_contact boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists prospects_normalized_email_unique on public.prospects(normalized_email);
create index if not exists prospects_company_idx on public.prospects(normalized_company_name);
create index if not exists prospects_country_industry_idx on public.prospects(country_code, industry);
create index if not exists prospects_priority_score_idx on public.prospects(priority, bidscope_fit_score desc);
create index if not exists prospects_import_idx on public.prospects(source_file_id);

create table if not exists public.prospect_source_records (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  import_id uuid not null references public.prospect_imports(id) on delete cascade,
  source_row_number integer not null,
  source_name text,
  raw_data jsonb not null,
  tender_activity_count integer not null default 0,
  award_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique(import_id, source_row_number)
);
create index if not exists prospect_source_records_prospect_idx on public.prospect_source_records(prospect_id, created_at desc);

create table if not exists public.prospect_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.prospect_imports(id) on delete cascade,
  row_number integer not null,
  raw_data jsonb not null,
  cleaned_data jsonb not null default '{}'::jsonb,
  status text not null default 'staged' check (status in ('staged','accepted','rejected','duplicate','possible_duplicate')),
  rejection_reasons text[] not null default '{}',
  duplicate_prospect_id uuid references public.prospects(id) on delete set null,
  duplicate_confidence numeric check (duplicate_confidence between 0 and 1),
  classification jsonb not null default '{}'::jsonb,
  fit_score integer check (fit_score between 0 and 100),
  prospect_id uuid references public.prospects(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(import_id, row_number)
);
create index if not exists prospect_import_rows_status_idx on public.prospect_import_rows(import_id, status, row_number);

create table if not exists public.prospect_segments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  country_code text,
  filter_definition jsonb not null default '{}'::jsonb,
  is_dynamic boolean not null default false,
  source_import_id uuid references public.prospect_imports(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prospect_segment_members (
  segment_id uuid not null references public.prospect_segments(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key(segment_id, prospect_id)
);

create table if not exists public.sender_identities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  from_name text not null,
  from_email text not null,
  reply_to text,
  provider text not null default 'resend',
  domain_verified boolean not null default false,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  objective text,
  target_segment_id uuid references public.prospect_segments(id) on delete set null,
  target_filter jsonb not null default '{}'::jsonb,
  brief jsonb not null default '{}'::jsonb,
  offer text,
  cta_label text,
  cta_url text,
  landing_page_url text,
  state text not null default 'draft' check (state in ('draft','needs_review','approved','scheduled','sending','paused','completed','cancelled')),
  subject_a text,
  subject_b text,
  ab_test_percent integer not null default 0 check (ab_test_percent between 0 and 100),
  sender_identity_id uuid references public.sender_identities(id) on delete set null,
  scheduled_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  started_by uuid references auth.users(id) on delete set null,
  started_at timestamptz,
  paused_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  recipient_limit integer,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists campaigns_state_schedule_idx on public.campaigns(state, scheduled_at);

create table if not exists public.campaign_steps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  step_order integer not null check (step_order > 0),
  delay_days integer not null default 0 check (delay_days >= 0),
  subject text not null,
  subject_variant_b text,
  html_body text not null,
  text_body text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(campaign_id, step_order)
);

create table if not exists public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','eligible','suppressed','active','stopped','completed','failed')),
  suppression_reason text,
  ab_variant text check (ab_variant in ('A','B')),
  current_step integer not null default 0,
  next_send_at timestamptz,
  stopped_reason text,
  stopped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(campaign_id, prospect_id)
);
create index if not exists campaign_recipients_queue_idx on public.campaign_recipients(status, next_send_at);
create index if not exists campaign_recipients_prospect_idx on public.campaign_recipients(prospect_id, status);

create table if not exists public.campaign_messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_recipient_id uuid not null references public.campaign_recipients(id) on delete cascade,
  campaign_step_id uuid not null references public.campaign_steps(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  provider text not null default 'resend',
  provider_message_id text,
  idempotency_key text not null unique,
  subject text not null,
  recipient_email text not null,
  rendered_html text not null,
  rendered_text text,
  status text not null default 'queued' check (status in ('queued','sending','sent','delivered','opened','clicked','replied','bounced','complained','failed','cancelled')),
  error_message text,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  replied_at timestamptz,
  bounced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists campaign_messages_provider_idx on public.campaign_messages(provider, provider_message_id);
create index if not exists campaign_messages_campaign_status_idx on public.campaign_messages(campaign_id, status, created_at);

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  provider_message_id text,
  campaign_message_id uuid references public.campaign_messages(id) on delete set null,
  event_type text not null,
  occurred_at timestamptz not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  unique(provider, provider_event_id)
);

create table if not exists public.suppression_list (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  normalized_email text not null unique,
  reason text not null check (reason in ('Unsubscribed','Hard Bounce','Spam Complaint','Manual Block','Invalid Email')),
  source text not null,
  prospect_id uuid references public.prospects(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references auth.users(id) on delete set null
);
create index if not exists suppression_active_idx on public.suppression_list(normalized_email) where removed_at is null;

create table if not exists public.campaign_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  description text,
  subject text not null,
  html_body text not null,
  text_body text,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_attribution (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_message_id uuid references public.campaign_messages(id) on delete set null,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  tracking_token_hash text not null unique,
  registered_user_id uuid references auth.users(id) on delete set null,
  first_clicked_at timestamptz,
  registered_at timestamptz,
  activated_at timestamptz,
  paid_at timestamptz,
  revenue numeric not null default 0,
  currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prospect_notes (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  body text not null,
  follow_up_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prospect_tags (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  tag text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(prospect_id, tag)
);

create table if not exists public.outreach_settings (
  id uuid primary key default gen_random_uuid(),
  singleton_key text not null unique default 'default' check (singleton_key = 'default'),
  provider text not null default 'resend',
  hourly_limit integer not null default 50 check (hourly_limit between 1 and 10000),
  daily_limit integer not null default 300 check (daily_limit between 1 and 100000),
  batch_size integer not null default 25 check (batch_size between 1 and 100),
  batch_delay_minutes integer not null default 10 check (batch_delay_minutes between 1 and 1440),
  minimum_campaign_gap_days integer not null default 14 check (minimum_campaign_gap_days between 0 and 365),
  sending_enabled boolean not null default false,
  emergency_stop boolean not null default true,
  fit_score_weights jsonb not null default '{"email":10,"website":5,"tenderActivity":25,"awards":20,"recency":15,"industry":15,"engagement":10}'::jsonb,
  taxonomy jsonb not null default '[]'::jsonb,
  default_footer text not null default 'BidScope · Where Opportunity Finds You.',
  compliance_name text not null default 'BidScope',
  compliance_address text,
  tracking_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.outreach_settings(singleton_key) values ('default') on conflict (singleton_key) do nothing;
insert into public.sender_identities(name,from_name,from_email,reply_to,provider,domain_verified,is_default,active)
values ('BidScope primary','BidScope','hello@bidscopeghana.com','hello@bidscopeghana.com','resend',true,true,true)
on conflict do nothing;

-- All outreach data is private. Even authenticated customers receive no direct table grants.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'prospect_imports','prospects','prospect_source_records','prospect_import_rows','prospect_segments','prospect_segment_members',
    'sender_identities','campaigns','campaign_steps','campaign_recipients','campaign_messages','email_events',
    'suppression_list','campaign_templates','campaign_attribution','prospect_notes','prospect_tags','outreach_settings'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists outreach_super_admin_all on public.%I', table_name);
    execute format('create policy outreach_super_admin_all on public.%I for all to authenticated using ((select public.is_super_admin())) with check ((select public.is_super_admin()))', table_name);
    execute format('grant all on public.%I to service_role', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  end loop;
end $$;

-- Private source files; only the service role used by guarded server routes accesses them.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('outreach-imports','outreach-imports',false,52428800,array['text/csv','application/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

do $$
declare table_name text;
begin
  foreach table_name in array array['prospect_imports','prospects','prospect_import_rows','prospect_segments','sender_identities','campaigns','campaign_steps','campaign_recipients','campaign_messages','campaign_templates','campaign_attribution','prospect_notes','outreach_settings'] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

create or replace function public.outreach_claim_send_batch(p_limit integer default 25)
returns setof public.campaign_messages
language plpgsql security definer set search_path=public as $$
begin
  return query
  with claimed as (
    select m.id
    from public.campaign_messages m
    join public.campaigns c on c.id=m.campaign_id
    join public.outreach_settings s on s.singleton_key='default'
    where m.status='queued' and c.state='sending' and s.sending_enabled and not s.emergency_stop
    order by m.queued_at
    for update of m skip locked
    limit least(greatest(p_limit,1),100)
  )
  update public.campaign_messages m set status='sending', updated_at=now()
  from claimed where m.id=claimed.id returning m.*;
end;
$$;
revoke all on function public.outreach_claim_send_batch(integer) from public, anon, authenticated;
grant execute on function public.outreach_claim_send_batch(integer) to service_role;

create or replace function public.outreach_prepare_campaign(p_campaign_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_campaign public.campaigns%rowtype; v_gap integer; v_total integer; v_eligible integer;
begin
  select * into v_campaign from public.campaigns where id=p_campaign_id for update;
  if not found then raise exception 'Campaign not found'; end if;
  if v_campaign.state <> 'needs_review' then raise exception 'Campaign must be in review before approval'; end if;
  select minimum_campaign_gap_days into v_gap from public.outreach_settings where singleton_key='default';
  insert into public.campaign_recipients(campaign_id,prospect_id,status,suppression_reason,ab_variant,next_send_at)
  select v_campaign.id,p.id,
    case when p.normalized_email is null then 'suppressed'
      when p.do_not_contact or p.unsubscribed_at is not null or p.bounced_at is not null then 'suppressed'
      when exists(select 1 from public.suppression_list s where s.normalized_email=p.normalized_email and s.removed_at is null) then 'suppressed'
      when exists(select 1 from public.campaign_recipients cr join public.campaigns c on c.id=cr.campaign_id where cr.prospect_id=p.id and cr.status in ('eligible','active') and c.state in ('approved','scheduled','sending','paused') and c.id<>v_campaign.id) then 'suppressed'
      when p.last_contacted_at is not null and p.last_contacted_at > now()-make_interval(days=>v_gap) then 'suppressed' else 'eligible' end,
    case when p.normalized_email is null then 'Missing valid email' when p.do_not_contact then 'Do not contact' when p.unsubscribed_at is not null then 'Unsubscribed' when p.bounced_at is not null then 'Hard bounced'
      when exists(select 1 from public.suppression_list s where s.normalized_email=p.normalized_email and s.removed_at is null) then 'Suppression list'
      when exists(select 1 from public.campaign_recipients cr join public.campaigns c on c.id=cr.campaign_id where cr.prospect_id=p.id and cr.status in ('eligible','active') and c.state in ('approved','scheduled','sending','paused') and c.id<>v_campaign.id) then 'Active campaign overlap'
      when p.last_contacted_at is not null and p.last_contacted_at > now()-make_interval(days=>v_gap) then 'Campaign frequency gap' else null end,
    case when v_campaign.subject_b is not null and abs(hashtext(p.id::text))%100 < v_campaign.ab_test_percent then 'B' else 'A' end,
    coalesce(v_campaign.scheduled_at,now())
  from public.prospects p
  where (v_campaign.target_segment_id is null or exists(select 1 from public.prospect_segment_members sm where sm.segment_id=v_campaign.target_segment_id and sm.prospect_id=p.id))
  order by p.bidscope_fit_score desc
  limit coalesce(v_campaign.recipient_limit,2147483647)
  on conflict(campaign_id,prospect_id) do update set status=excluded.status,suppression_reason=excluded.suppression_reason,ab_variant=excluded.ab_variant,next_send_at=excluded.next_send_at,updated_at=now();
  select count(*),count(*) filter(where status='eligible') into v_total,v_eligible from public.campaign_recipients where campaign_id=v_campaign.id;
  return jsonb_build_object('recipients',v_total,'eligible',v_eligible,'suppressed',v_total-v_eligible);
end $$;
revoke all on function public.outreach_prepare_campaign(uuid) from public,anon,authenticated;
grant execute on function public.outreach_prepare_campaign(uuid) to service_role;
