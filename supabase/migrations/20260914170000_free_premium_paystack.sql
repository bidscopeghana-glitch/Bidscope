-- BidScope organisation billing and entitlement foundation.
-- Paid prices deliberately remain null until configured by an authorised admin.

create table if not exists public.billing_plans (
  code text primary key,
  tier text not null check (tier in ('FREE','PREMIUM')),
  name text not null,
  description text not null default '',
  billing_interval text not null check (billing_interval in ('NONE','MONTHLY','ANNUAL','ONE_TIME_30','ONE_TIME_365')),
  payment_kind text not null check (payment_kind in ('FREE','RECURRING_CARD','NON_RENEWING')),
  currency text not null default 'GHS' check (char_length(currency)=3),
  amount_minor bigint check (amount_minor is null or amount_minor >= 0),
  provider_plan_code text,
  features jsonb not null default '{}'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  access_days integer check (access_days is null or access_days > 0),
  activation_status text not null default 'PRICING_CONFIGURATION_REQUIRED' check (activation_status in ('PRICING_CONFIGURATION_REQUIRED','TEST_READY','LIVE')),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.billing_plans(code,tier,name,description,billing_interval,payment_kind,currency,amount_minor,features,limits,access_days,activation_status,enabled)
values
 ('free','FREE','BidScope Free','Discover procurement opportunities and verify them at the official source.','NONE','FREE','GHS',0,
  '{"basic_discovery":true,"official_sources":true,"basic_recommendations":true,"basic_notifications":true}'::jsonb,
  '{"saved_opportunities":5,"tender_watches":1,"buyer_follows":2,"ai_analyses_per_period":3}'::jsonb,null,'LIVE',true),
 ('premium_monthly','PREMIUM','BidScope Premium Monthly','Find the contracts worth pursuing and monitor them automatically.','MONTHLY','RECURRING_CARD','GHS',null,
  '{"advanced_feed":true,"best_match":true,"advanced_matching":true,"smart_alerts":true,"follow_buyers":true,"buyer_intelligence":true,"bid_advisor":true,"procurement_radar":true,"change_monitoring":true,"readiness_score":true,"tender_intelligence_report":true,"ai_assistant":true,"bid_workspace":true,"international_eligibility":true,"market_intelligence":true}'::jsonb,
  '{"saved_opportunities":500,"tender_watches":50,"buyer_follows":100,"ai_analyses_per_period":100,"grace_period_days":3}'::jsonb,null,'PRICING_CONFIGURATION_REQUIRED',false),
 ('premium_annual','PREMIUM','BidScope Premium Annual','Annual recurring Premium access paid by card.','ANNUAL','RECURRING_CARD','GHS',null,
  '{"advanced_feed":true,"best_match":true,"advanced_matching":true,"smart_alerts":true,"follow_buyers":true,"buyer_intelligence":true,"bid_advisor":true,"procurement_radar":true,"change_monitoring":true,"readiness_score":true,"tender_intelligence_report":true,"ai_assistant":true,"bid_workspace":true,"international_eligibility":true,"market_intelligence":true}'::jsonb,
  '{"saved_opportunities":500,"tender_watches":50,"buyer_follows":100,"ai_analyses_per_period":1200,"grace_period_days":3}'::jsonb,null,'PRICING_CONFIGURATION_REQUIRED',false),
 ('premium_momo_30','PREMIUM','BidScope Premium — 30 days','Non-renewing 30-day Premium access paid by Mobile Money.','ONE_TIME_30','NON_RENEWING','GHS',null,
  '{"advanced_feed":true,"best_match":true,"advanced_matching":true,"smart_alerts":true,"follow_buyers":true,"buyer_intelligence":true,"bid_advisor":true,"procurement_radar":true,"change_monitoring":true,"readiness_score":true,"tender_intelligence_report":true,"ai_assistant":true,"bid_workspace":true,"international_eligibility":true,"market_intelligence":true}'::jsonb,
  '{"saved_opportunities":500,"tender_watches":50,"buyer_follows":100,"ai_analyses_per_period":100,"grace_period_days":3}'::jsonb,30,'PRICING_CONFIGURATION_REQUIRED',false),
 ('premium_momo_365','PREMIUM','BidScope Premium — 365 days','Non-renewing annual Premium access paid by Mobile Money.','ONE_TIME_365','NON_RENEWING','GHS',null,
  '{"advanced_feed":true,"best_match":true,"advanced_matching":true,"smart_alerts":true,"follow_buyers":true,"buyer_intelligence":true,"bid_advisor":true,"procurement_radar":true,"change_monitoring":true,"readiness_score":true,"tender_intelligence_report":true,"ai_assistant":true,"bid_workspace":true,"international_eligibility":true,"market_intelligence":true}'::jsonb,
  '{"saved_opportunities":500,"tender_watches":50,"buyer_follows":100,"ai_analyses_per_period":1200,"grace_period_days":3}'::jsonb,365,'PRICING_CONFIGURATION_REQUIRED',false)
on conflict (code) do nothing;

alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions alter column plan_code set default 'free';
alter table public.subscriptions alter column status set default 'FREE';
update public.subscriptions set status=case lower(status)
  when 'trialing' then 'ACTIVE' when 'active' then 'ACTIVE' when 'past_due' then 'PAST_DUE'
  when 'paused' then 'GRACE_PERIOD' when 'cancelled' then 'CANCELLED' when 'expired' then 'EXPIRED'
  else upper(status) end;
update public.subscriptions set plan_code='free' where lower(plan_code)<>'premium';
alter table public.subscriptions add constraint subscriptions_status_check check (status in ('FREE','PENDING','ACTIVE','PAST_DUE','GRACE_PERIOD','CANCEL_AT_PERIOD_END','CANCELLED','EXPIRED','PAYMENT_FAILED','INCOMPLETE'));
alter table public.subscriptions add column if not exists provider_customer_code text;
alter table public.subscriptions add column if not exists provider_subscription_code text;
alter table public.subscriptions add column if not exists provider_plan_code text;
alter table public.subscriptions add column if not exists billing_interval text;
alter table public.subscriptions add column if not exists currency text;
alter table public.subscriptions add column if not exists amount_minor bigint;
alter table public.subscriptions add column if not exists started_at timestamptz;
alter table public.subscriptions add column if not exists last_payment_at timestamptz;
alter table public.subscriptions add column if not exists next_payment_at timestamptz;
alter table public.subscriptions add column if not exists grace_period_end timestamptz;
alter table public.subscriptions add column if not exists cancelled_at timestamptz;
alter table public.subscriptions add column if not exists payment_method_summary jsonb not null default '{}'::jsonb;

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  initiated_by uuid references auth.users(id) on delete set null,
  provider text not null default 'paystack',
  reference text not null unique,
  provider_transaction_id text,
  billing_plan_code text not null references public.billing_plans(code),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (char_length(currency)=3),
  payment_kind text not null check (payment_kind in ('RECURRING_CARD','NON_RENEWING')),
  status text not null default 'PENDING' check (status in ('PENDING','SUCCESS','FAILED','UNVERIFIED')),
  authorization_url text,
  access_code text,
  channel text,
  provider_customer_code text,
  provider_subscription_code text,
  paid_at timestamptz,
  verified_at timestamptz,
  failure_reason text,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payment_transactions_org_created_idx on public.payment_transactions(organization_id,created_at desc);
create index if not exists payment_transactions_status_idx on public.payment_transactions(status,created_at);

create table if not exists public.entitlement_usage (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  feature text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  usage_count integer not null default 0 check (usage_count >= 0),
  updated_at timestamptz not null default now(),
  primary key(organization_id,feature,period_start)
);

create table if not exists public.subscription_manual_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  reason text not null check (char_length(trim(reason)) >= 8),
  starts_at timestamptz not null,
  expires_at timestamptz not null check (expires_at > starts_at),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.increment_entitlement_usage(p_organization_id uuid,p_feature text,p_period_start timestamptz,p_period_end timestamptz)
returns integer language plpgsql security definer set search_path=public as $$
declare result integer;
begin
  insert into public.entitlement_usage(organization_id,feature,period_start,period_end,usage_count)
  values(p_organization_id,p_feature,p_period_start,p_period_end,1)
  on conflict(organization_id,feature,period_start) do update set usage_count=entitlement_usage.usage_count+1,updated_at=now()
  returning usage_count into result;
  return result;
end $$;
revoke all on function public.increment_entitlement_usage(uuid,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.increment_entitlement_usage(uuid,text,timestamptz,timestamptz) to service_role;

create or replace function public.complete_paystack_payment(
  p_reference text,
  p_provider_transaction_id text,
  p_amount_minor bigint,
  p_currency text,
  p_paid_at timestamptz,
  p_channel text,
  p_customer_code text default null,
  p_subscription_code text default null,
  p_payment_method jsonb default '{}'::jsonb,
  p_provider_payload jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  tx public.payment_transactions;
  bp public.billing_plans;
  base_at timestamptz;
  end_at timestamptz;
begin
  select * into tx from public.payment_transactions where reference=p_reference for update;
  if tx.id is null then raise exception 'unknown payment reference'; end if;
  if tx.status='SUCCESS' then return jsonb_build_object('processed',false,'idempotent',true,'organization_id',tx.organization_id); end if;
  if tx.amount_minor<>p_amount_minor or upper(tx.currency)<>upper(p_currency) then raise exception 'payment amount or currency mismatch'; end if;
  select * into bp from public.billing_plans where code=tx.billing_plan_code;
  if bp.code is null or bp.tier<>'PREMIUM' or bp.amount_minor is null or bp.amount_minor<>tx.amount_minor then raise exception 'billing plan is not fulfilment ready'; end if;
  if tx.payment_kind='RECURRING_CARD' and lower(coalesce(p_channel,''))<>'card' then raise exception 'recurring Premium requires card payment'; end if;
  select greatest(p_paid_at,coalesce(current_period_ends_at,p_paid_at)) into base_at from public.subscriptions where organization_id=tx.organization_id;
  base_at:=coalesce(base_at,p_paid_at);
  end_at:=case bp.billing_interval when 'MONTHLY' then base_at+interval '1 month' when 'ANNUAL' then base_at+interval '1 year' else base_at+make_interval(days=>bp.access_days) end;
  update public.payment_transactions set status='SUCCESS',provider_transaction_id=p_provider_transaction_id,channel=p_channel,provider_customer_code=p_customer_code,provider_subscription_code=p_subscription_code,paid_at=p_paid_at,verified_at=now(),provider_payload=p_provider_payload,updated_at=now() where id=tx.id;
  insert into public.subscriptions(organization_id,provider,provider_customer_code,provider_subscription_code,provider_plan_code,plan_code,status,billing_interval,currency,amount_minor,started_at,current_period_starts_at,current_period_ends_at,last_payment_at,next_payment_at,cancel_at_period_end,payment_method_summary,metadata)
  values(tx.organization_id,'paystack',p_customer_code,p_subscription_code,bp.provider_plan_code,'premium','ACTIVE',bp.billing_interval,bp.currency,bp.amount_minor,p_paid_at,p_paid_at,end_at,p_paid_at,case when tx.payment_kind='RECURRING_CARD' then end_at else null end,false,p_payment_method,jsonb_build_object('billing_plan_code',bp.code,'payment_kind',bp.payment_kind))
  on conflict(organization_id) do update set provider='paystack',provider_customer_code=excluded.provider_customer_code,provider_subscription_code=coalesce(excluded.provider_subscription_code,subscriptions.provider_subscription_code),provider_plan_code=excluded.provider_plan_code,plan_code='premium',status='ACTIVE',billing_interval=excluded.billing_interval,currency=excluded.currency,amount_minor=excluded.amount_minor,started_at=coalesce(subscriptions.started_at,excluded.started_at),current_period_starts_at=excluded.current_period_starts_at,current_period_ends_at=greatest(coalesce(subscriptions.current_period_ends_at,excluded.current_period_starts_at),excluded.current_period_ends_at),last_payment_at=excluded.last_payment_at,next_payment_at=excluded.next_payment_at,cancel_at_period_end=false,payment_method_summary=excluded.payment_method_summary,metadata=excluded.metadata,updated_at=now();
  return jsonb_build_object('processed',true,'idempotent',false,'organization_id',tx.organization_id,'period_end',end_at);
end $$;

revoke all on function public.complete_paystack_payment(text,text,bigint,text,timestamptz,text,text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.complete_paystack_payment(text,text,bigint,text,timestamptz,text,text,text,jsonb,jsonb) to service_role;

alter table public.billing_plans enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.entitlement_usage enable row level security;
alter table public.subscription_manual_grants enable row level security;
drop policy if exists billing_plans_authenticated_read on public.billing_plans;
create policy billing_plans_authenticated_read on public.billing_plans for select to authenticated using(true);
drop policy if exists payment_transactions_member_read on public.payment_transactions;
create policy payment_transactions_member_read on public.payment_transactions for select to authenticated using(public.is_organization_member(organization_id));
drop policy if exists entitlement_usage_member_read on public.entitlement_usage;
create policy entitlement_usage_member_read on public.entitlement_usage for select to authenticated using(public.is_organization_member(organization_id));
drop policy if exists subscription_manual_grants_admin_read on public.subscription_manual_grants;
create policy subscription_manual_grants_admin_read on public.subscription_manual_grants for select to authenticated using(public.is_organization_admin(organization_id));

grant select on public.billing_plans,public.payment_transactions,public.entitlement_usage,public.subscription_manual_grants to authenticated;
grant all on public.billing_plans,public.payment_transactions,public.entitlement_usage,public.subscription_manual_grants to service_role;

drop trigger if exists billing_plans_set_updated_at on public.billing_plans;
create trigger billing_plans_set_updated_at before update on public.billing_plans for each row execute function public.set_updated_at();
drop trigger if exists payment_transactions_set_updated_at on public.payment_transactions;
create trigger payment_transactions_set_updated_at before update on public.payment_transactions for each row execute function public.set_updated_at();
