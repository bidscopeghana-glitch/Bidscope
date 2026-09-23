begin;

-- The earlier rollout appended Workers AI to every customer-facing route.
-- Keep the adapter and health checks, but require a separately reviewed,
-- non-sensitive classification task before any production inference routing.
update public.ai_feature_routes
set standard_provider_order = array_remove(standard_provider_order, 'cloudflare'),
    premium_provider_order = array_remove(premium_provider_order, 'cloudflare'),
    updated_at = now()
where 'cloudflare' = any(standard_provider_order)
   or 'cloudflare' = any(premium_provider_order);

update public.ai_models
set task_types = array['public_tender_classification_review']::text[]
where provider = 'cloudflare';

commit;
