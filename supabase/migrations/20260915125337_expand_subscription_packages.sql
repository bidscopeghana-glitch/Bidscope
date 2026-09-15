-- Expand BidScope from one undifferentiated Premium tier into three paid
-- intelligence packages. Checkout remains disabled until each recurring
-- product is paired with its intentionally-created Paystack plan code.

update public.billing_plans
set enabled = false,
    updated_at = now()
where code in ('premium_monthly','premium_annual','premium_momo_30','premium_momo_365');

insert into public.billing_plans (
  code,tier,name,description,billing_interval,payment_kind,currency,
  amount_minor,provider_plan_code,features,limits,access_days,
  activation_status,enabled
)
values
  ('professional_monthly','PREMIUM','BidScope Professional','Monitor the opportunities that match your business and act before deadlines.','MONTHLY','RECURRING_CARD','GHS',29500,null,
   '{"advanced_feed":true,"best_match":true,"advanced_matching":true,"smart_alerts":true,"follow_buyers":true,"procurement_radar":true,"change_monitoring":true,"international_eligibility":true}'::jsonb,
   '{"saved_opportunities":100,"tender_watches":10,"buyer_follows":25,"ai_analyses_per_period":30,"team_seats":1,"alert_recipients":1,"grace_period_days":3}'::jsonb,null,'PRICING_CONFIGURATION_REQUIRED',false),
  ('professional_annual','PREMIUM','BidScope Professional','Annual Professional access with two months included.','ANNUAL','RECURRING_CARD','GHS',295000,null,
   '{"advanced_feed":true,"best_match":true,"advanced_matching":true,"smart_alerts":true,"follow_buyers":true,"procurement_radar":true,"change_monitoring":true,"international_eligibility":true}'::jsonb,
   '{"saved_opportunities":100,"tender_watches":10,"buyer_follows":25,"ai_analyses_per_period":360,"team_seats":1,"alert_recipients":1,"grace_period_days":3}'::jsonb,null,'PRICING_CONFIGURATION_REQUIRED',false),
  ('intelligence_monthly','PREMIUM','BidScope Intelligence','Qualify opportunities with buyer, award, eligibility and AI-backed decision intelligence.','MONTHLY','RECURRING_CARD','GHS',45000,null,
   '{"advanced_feed":true,"best_match":true,"advanced_matching":true,"smart_alerts":true,"follow_buyers":true,"buyer_intelligence":true,"bid_advisor":true,"procurement_radar":true,"change_monitoring":true,"readiness_score":true,"tender_intelligence_report":true,"ai_assistant":true,"international_eligibility":true,"market_intelligence":true,"csv_exports":true,"multi_recipient_alerts":true}'::jsonb,
   '{"saved_opportunities":500,"tender_watches":50,"buyer_follows":100,"ai_analyses_per_period":300,"team_seats":3,"alert_recipients":3,"grace_period_days":3}'::jsonb,null,'PRICING_CONFIGURATION_REQUIRED',false),
  ('intelligence_annual','PREMIUM','BidScope Intelligence','Annual Intelligence access with two months included.','ANNUAL','RECURRING_CARD','GHS',450000,null,
   '{"advanced_feed":true,"best_match":true,"advanced_matching":true,"smart_alerts":true,"follow_buyers":true,"buyer_intelligence":true,"bid_advisor":true,"procurement_radar":true,"change_monitoring":true,"readiness_score":true,"tender_intelligence_report":true,"ai_assistant":true,"international_eligibility":true,"market_intelligence":true,"csv_exports":true,"multi_recipient_alerts":true}'::jsonb,
   '{"saved_opportunities":500,"tender_watches":50,"buyer_follows":100,"ai_analyses_per_period":3600,"team_seats":3,"alert_recipients":3,"grace_period_days":3}'::jsonb,null,'PRICING_CONFIGURATION_REQUIRED',false),
  ('business_monthly','PREMIUM','BidScope Business','Run a complete bidding workflow with the highest monitoring and analysis allowances.','MONTHLY','RECURRING_CARD','GHS',60000,null,
   '{"advanced_feed":true,"best_match":true,"advanced_matching":true,"smart_alerts":true,"follow_buyers":true,"buyer_intelligence":true,"bid_advisor":true,"procurement_radar":true,"change_monitoring":true,"readiness_score":true,"tender_intelligence_report":true,"ai_assistant":true,"bid_workspace":true,"international_eligibility":true,"market_intelligence":true,"csv_exports":true,"multi_recipient_alerts":true}'::jsonb,
   '{"saved_opportunities":2000,"tender_watches":200,"buyer_follows":500,"ai_analyses_per_period":1200,"team_seats":5,"alert_recipients":5,"grace_period_days":3}'::jsonb,null,'PRICING_CONFIGURATION_REQUIRED',false),
  ('business_annual','PREMIUM','BidScope Business','Annual Business access with two months included.','ANNUAL','RECURRING_CARD','GHS',600000,null,
   '{"advanced_feed":true,"best_match":true,"advanced_matching":true,"smart_alerts":true,"follow_buyers":true,"buyer_intelligence":true,"bid_advisor":true,"procurement_radar":true,"change_monitoring":true,"readiness_score":true,"tender_intelligence_report":true,"ai_assistant":true,"bid_workspace":true,"international_eligibility":true,"market_intelligence":true,"csv_exports":true,"multi_recipient_alerts":true}'::jsonb,
   '{"saved_opportunities":2000,"tender_watches":200,"buyer_follows":500,"ai_analyses_per_period":14400,"team_seats":5,"alert_recipients":5,"grace_period_days":3}'::jsonb,null,'PRICING_CONFIGURATION_REQUIRED',false)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  amount_minor = excluded.amount_minor,
  features = excluded.features,
  limits = excluded.limits,
  updated_at = now();
