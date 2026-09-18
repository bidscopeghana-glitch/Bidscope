update public.billing_plans set name='BidScope Premium Team', updated_at=now()
where code in ('premium_launch_monthly','premium_launch_annual');

update public.billing_plans set name='BidScope Platinum Team', updated_at=now()
where code in ('platinum_launch_monthly','platinum_launch_annual');
