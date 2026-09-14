-- BidScope production pricing and Paystack Live Mode recurring plan references.
-- Prices are stored in Ghana pesewas.
update public.billing_plans
set amount_minor = 10000,
    provider_plan_code = 'PLN_pfcpcb409w5qk0l',
    activation_status = 'LIVE',
    enabled = true,
    updated_at = now()
where code = 'premium_monthly';

update public.billing_plans
set amount_minor = 110000,
    provider_plan_code = 'PLN_b7jhbtklxk1iwxi',
    activation_status = 'LIVE',
    enabled = true,
    updated_at = now()
where code = 'premium_annual';

update public.billing_plans
set amount_minor = 10000,
    provider_plan_code = null,
    activation_status = 'LIVE',
    enabled = true,
    updated_at = now()
where code = 'premium_momo_30';

update public.billing_plans
set amount_minor = 100000,
    provider_plan_code = null,
    activation_status = 'LIVE',
    enabled = true,
    updated_at = now()
where code = 'premium_momo_365';
