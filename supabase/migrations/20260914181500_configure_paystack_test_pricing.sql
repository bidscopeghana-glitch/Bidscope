-- Approved BidScope launch pricing and Paystack Test Mode recurring plan references.
-- Prices are stored in Ghana pesewas.
update public.billing_plans
set amount_minor = 10000,
    provider_plan_code = 'PLN_6m4bmr0ywot24ak',
    activation_status = 'TEST_READY',
    enabled = true,
    updated_at = now()
where code = 'premium_monthly';

update public.billing_plans
set amount_minor = 110000,
    provider_plan_code = 'PLN_j5bnccy194uezeo',
    activation_status = 'TEST_READY',
    enabled = true,
    updated_at = now()
where code = 'premium_annual';

update public.billing_plans
set amount_minor = 10000,
    provider_plan_code = null,
    activation_status = 'TEST_READY',
    enabled = true,
    updated_at = now()
where code = 'premium_momo_30';

update public.billing_plans
set amount_minor = 100000,
    provider_plan_code = null,
    activation_status = 'TEST_READY',
    enabled = true,
    updated_at = now()
where code = 'premium_momo_365';
