-- Mobile Money is offered only as non-renewing access. Monthly and annual
-- subscriptions remain card-only because Paystack recurring plans require a
-- reusable card authorization.
update public.billing_plans
set name='BidScope Premium Team — 30 days', description='One-time 30-day Premium Team access paid by Mobile Money.', amount_minor=35000, billing_interval='ONE_TIME_30', payment_kind='NON_RENEWING', provider_plan_code=null, access_days=30, activation_status='PRICING_CONFIGURATION_REQUIRED', enabled=false, updated_at=now()
where code='premium_momo_30';

update public.billing_plans
set name='BidScope Premium Team — 365 days', description='One-time 365-day Premium Team access paid by Mobile Money.', amount_minor=350000, billing_interval='ONE_TIME_365', payment_kind='NON_RENEWING', provider_plan_code=null, access_days=365, activation_status='PRICING_CONFIGURATION_REQUIRED', enabled=false, updated_at=now()
where code='premium_momo_365';

insert into public.billing_plans(code,tier,name,description,billing_interval,payment_kind,currency,amount_minor,provider_plan_code,features,limits,access_days,activation_status,enabled)
select 'pro_momo_'||case when p.billing_interval='MONTHLY' then '30' else '365' end,
       p.tier,
       'BidScope Pro — '||case when p.billing_interval='MONTHLY' then '30 days' else '365 days' end,
       'One-time Pro access paid by Mobile Money.',
       case when p.billing_interval='MONTHLY' then 'ONE_TIME_30' else 'ONE_TIME_365' end,
       'NON_RENEWING','GHS',p.amount_minor,null,p.features,p.limits,case when p.billing_interval='MONTHLY' then 30 else 365 end,'PRICING_CONFIGURATION_REQUIRED',false
from public.billing_plans p where p.code in ('pro_launch_monthly','pro_launch_annual')
on conflict(code) do update set amount_minor=excluded.amount_minor,features=excluded.features,limits=excluded.limits,access_days=excluded.access_days,updated_at=now();

insert into public.billing_plans(code,tier,name,description,billing_interval,payment_kind,currency,amount_minor,provider_plan_code,features,limits,access_days,activation_status,enabled)
select 'platinum_momo_'||case when p.billing_interval='MONTHLY' then '30' else '365' end,
       p.tier,
       'BidScope Platinum Team — '||case when p.billing_interval='MONTHLY' then '30 days' else '365 days' end,
       'One-time Platinum Team access paid by Mobile Money.',
       case when p.billing_interval='MONTHLY' then 'ONE_TIME_30' else 'ONE_TIME_365' end,
       'NON_RENEWING','GHS',p.amount_minor,null,p.features,p.limits,case when p.billing_interval='MONTHLY' then 30 else 365 end,'PRICING_CONFIGURATION_REQUIRED',false
from public.billing_plans p where p.code in ('platinum_launch_monthly','platinum_launch_annual')
on conflict(code) do update set amount_minor=excluded.amount_minor,features=excluded.features,limits=excluded.limits,access_days=excluded.access_days,updated_at=now();
