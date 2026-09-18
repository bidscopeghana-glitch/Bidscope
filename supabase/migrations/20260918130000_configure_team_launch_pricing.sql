-- Configure the public launch catalogue for the recommended Team pricing.
-- Paystack provider_plan_code values stay null until the matching recurring
-- plans are created in Paystack; activating a plan without a real provider
-- code would make checkout unsafe.
update public.billing_plans
set name='BidScope Pro',
    amount_minor=15000,
    activation_status='PRICING_CONFIGURATION_REQUIRED',
    enabled=false,
    updated_at=now()
where code='pro_launch_monthly';

update public.billing_plans
set name='BidScope Pro',
    amount_minor=150000,
    activation_status='PRICING_CONFIGURATION_REQUIRED',
    enabled=false,
    updated_at=now()
where code='pro_launch_annual';

update public.billing_plans
set name='BidScope Premium Team',
    description='Shared procurement intelligence for small bidding teams of up to three users.',
    amount_minor=35000,
    activation_status='PRICING_CONFIGURATION_REQUIRED',
    enabled=false,
    updated_at=now()
where code='premium_launch_monthly';

update public.billing_plans
set name='BidScope Premium Team',
    description='Annual Premium Team access with two months included.',
    amount_minor=350000,
    activation_status='PRICING_CONFIGURATION_REQUIRED',
    enabled=false,
    updated_at=now()
where code='premium_launch_annual';

update public.billing_plans
set name='BidScope Platinum Team',
    description='Full bidding workflow and collaboration for established teams of up to five users.',
    amount_minor=75000,
    activation_status='PRICING_CONFIGURATION_REQUIRED',
    enabled=false,
    updated_at=now()
where code='platinum_launch_monthly';

update public.billing_plans
set name='BidScope Platinum Team',
    description='Annual Platinum Team access with two months included.',
    amount_minor=750000,
    activation_status='PRICING_CONFIGURATION_REQUIRED',
    enabled=false,
    updated_at=now()
where code='platinum_launch_annual';
