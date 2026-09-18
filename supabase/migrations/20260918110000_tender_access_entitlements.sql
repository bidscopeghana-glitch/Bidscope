-- Paid plans unlock actionable tender intelligence; free remains preview-only.
update public.billing_plans
set features = features || '{"tender_source_access":true,"tender_documents":true,"buyer_intelligence":true,"incumbent_intelligence":true,"document_analysis":true,"partner_marketplace":true,"bid_writer":true,"advanced_alerts":true}'::jsonb
where tier = 'PREMIUM';

update public.billing_plans
set features = features || '{"tender_source_access":false,"tender_documents":false,"buyer_intelligence":false,"incumbent_intelligence":false,"document_analysis":false,"partner_marketplace":false,"bid_writer":false,"advanced_alerts":false}'::jsonb
where tier = 'FREE';
