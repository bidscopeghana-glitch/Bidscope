-- Configure the live Paystack recurring card plans supplied by the account owner.
-- Mobile Money packages intentionally remain non-renewing and are not assigned plan codes.
update public.billing_plans
set provider_plan_code='PLN_278n57ydsloqi5g', amount_minor=15000,
    activation_status='LIVE', enabled=true, updated_at=now()
where code='pro_launch_monthly';

update public.billing_plans
set provider_plan_code='PLN_lwj4ml9qa4q7sdx', amount_minor=150000,
    activation_status='LIVE', enabled=true, updated_at=now()
where code='pro_launch_annual';

update public.billing_plans
set provider_plan_code='PLN_pfcpcb409w5qk0l', amount_minor=35000,
    activation_status='LIVE', enabled=true, updated_at=now()
where code='premium_launch_monthly';

update public.billing_plans
set provider_plan_code='PLN_b7jhbtklxk1iwxi', amount_minor=350000,
    activation_status='LIVE', enabled=true, updated_at=now()
where code='premium_launch_annual';

update public.billing_plans
set provider_plan_code='PLN_8eisfy2m00qlivc', amount_minor=75000,
    activation_status='LIVE', enabled=true, updated_at=now()
where code='platinum_launch_monthly';

update public.billing_plans
set provider_plan_code='PLN_72f72grw3ayncs1', amount_minor=750000,
    activation_status='LIVE', enabled=true, updated_at=now()
where code='platinum_launch_annual';
