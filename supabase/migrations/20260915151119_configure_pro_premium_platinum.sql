-- Replace the previous paid package catalogue with the approved Pro, Premium
-- and Platinum tiers. Prices are authoritative in pesewas and each package is
-- bound to the matching Paystack Live recurring plan.

update public.profiles
set is_super_admin=true,
    updated_at=now()
where lower(email)='basintaleuk@gmail.com';

update public.billing_plans
set enabled=false,
    activation_status='PRICING_CONFIGURATION_REQUIRED',
    updated_at=now()
where tier='PREMIUM';

insert into public.billing_plans(
  code,tier,name,description,billing_interval,payment_kind,currency,
  amount_minor,provider_plan_code,features,limits,access_days,
  activation_status,enabled
)
values
  ('pro_monthly','PREMIUM','BidScope Pro','Discover, match and monitor the opportunities worth pursuing.','MONTHLY','RECURRING_CARD','GHS',50000,'PLN_278n57ydsloqi5g',
   '{"advanced_feed":true,"best_match":true,"advanced_matching":true,"smart_alerts":true,"follow_buyers":true,"procurement_radar":true,"change_monitoring":true,"international_eligibility":true}'::jsonb,
   '{"saved_opportunities":100,"tender_watches":10,"buyer_follows":25,"ai_analyses_per_period":30,"team_seats":1,"alert_recipients":1,"grace_period_days":3}'::jsonb,null,'LIVE',true),
  ('pro_annual','PREMIUM','BidScope Pro','Annual Pro access with two months included.','ANNUAL','RECURRING_CARD','GHS',500000,'PLN_lwj4ml9qa4q7sdx',
   '{"advanced_feed":true,"best_match":true,"advanced_matching":true,"smart_alerts":true,"follow_buyers":true,"procurement_radar":true,"change_monitoring":true,"international_eligibility":true}'::jsonb,
   '{"saved_opportunities":100,"tender_watches":10,"buyer_follows":25,"ai_analyses_per_period":360,"team_seats":1,"alert_recipients":1,"grace_period_days":3}'::jsonb,null,'LIVE',true),
  ('premium_monthly','PREMIUM','BidScope Premium','Qualify opportunities using buyer, award, eligibility and AI-backed decision intelligence.','MONTHLY','RECURRING_CARD','GHS',100000,'PLN_pfcpcb409w5qk0l',
   '{"advanced_feed":true,"best_match":true,"advanced_matching":true,"smart_alerts":true,"follow_buyers":true,"buyer_intelligence":true,"bid_advisor":true,"procurement_radar":true,"change_monitoring":true,"readiness_score":true,"tender_intelligence_report":true,"ai_assistant":true,"international_eligibility":true,"market_intelligence":true,"csv_exports":true,"multi_recipient_alerts":true}'::jsonb,
   '{"saved_opportunities":500,"tender_watches":50,"buyer_follows":100,"ai_analyses_per_period":300,"team_seats":3,"alert_recipients":3,"grace_period_days":3}'::jsonb,null,'LIVE',true),
  ('premium_annual','PREMIUM','BidScope Premium','Annual Premium access with two months included.','ANNUAL','RECURRING_CARD','GHS',1000000,'PLN_b7jhbtklxk1iwxi',
   '{"advanced_feed":true,"best_match":true,"advanced_matching":true,"smart_alerts":true,"follow_buyers":true,"buyer_intelligence":true,"bid_advisor":true,"procurement_radar":true,"change_monitoring":true,"readiness_score":true,"tender_intelligence_report":true,"ai_assistant":true,"international_eligibility":true,"market_intelligence":true,"csv_exports":true,"multi_recipient_alerts":true}'::jsonb,
   '{"saved_opportunities":500,"tender_watches":50,"buyer_follows":100,"ai_analyses_per_period":3600,"team_seats":3,"alert_recipients":3,"grace_period_days":3}'::jsonb,null,'LIVE',true),
  ('platinum_monthly','PREMIUM','BidScope Platinum','Run a complete bidding workflow with the highest monitoring and analysis allowances.','MONTHLY','RECURRING_CARD','GHS',150000,'PLN_8eisfy2m00qlivc',
   '{"advanced_feed":true,"best_match":true,"advanced_matching":true,"smart_alerts":true,"follow_buyers":true,"buyer_intelligence":true,"bid_advisor":true,"procurement_radar":true,"change_monitoring":true,"readiness_score":true,"tender_intelligence_report":true,"ai_assistant":true,"bid_workspace":true,"international_eligibility":true,"market_intelligence":true,"csv_exports":true,"multi_recipient_alerts":true}'::jsonb,
   '{"saved_opportunities":2000,"tender_watches":200,"buyer_follows":500,"ai_analyses_per_period":1200,"team_seats":5,"alert_recipients":5,"grace_period_days":3}'::jsonb,null,'LIVE',true),
  ('platinum_annual','PREMIUM','BidScope Platinum','Annual Platinum access with two months included.','ANNUAL','RECURRING_CARD','GHS',1500000,'PLN_72f72grw3ayncs1',
   '{"advanced_feed":true,"best_match":true,"advanced_matching":true,"smart_alerts":true,"follow_buyers":true,"buyer_intelligence":true,"bid_advisor":true,"procurement_radar":true,"change_monitoring":true,"readiness_score":true,"tender_intelligence_report":true,"ai_assistant":true,"bid_workspace":true,"international_eligibility":true,"market_intelligence":true,"csv_exports":true,"multi_recipient_alerts":true}'::jsonb,
   '{"saved_opportunities":2000,"tender_watches":200,"buyer_follows":500,"ai_analyses_per_period":14400,"team_seats":5,"alert_recipients":5,"grace_period_days":3}'::jsonb,null,'LIVE',true)
on conflict(code) do update set
  name=excluded.name,
  description=excluded.description,
  billing_interval=excluded.billing_interval,
  payment_kind=excluded.payment_kind,
  currency=excluded.currency,
  amount_minor=excluded.amount_minor,
  provider_plan_code=excluded.provider_plan_code,
  features=excluded.features,
  limits=excluded.limits,
  access_days=excluded.access_days,
  activation_status=excluded.activation_status,
  enabled=excluded.enabled,
  updated_at=now();
