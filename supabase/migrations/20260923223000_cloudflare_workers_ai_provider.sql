begin;

insert into public.ai_providers (
  id, display_name, enabled, role, secret_env_var, priority,
  allow_sensitive_data, allow_customer_documents, data_retention_notes
) values (
  'cloudflare', 'Cloudflare Workers AI', false, 'fallback',
  'CLOUDFLARE_WORKERS_AI_TOKEN', 45, false, false,
  'Cloudflare-hosted inference for routine, non-sensitive text only. AI Gateway request logging and caching remain disabled. Enable after a successful connection test.'
)
on conflict (id) do nothing;

insert into public.ai_models (
  provider, model_id, display_name, task_types, reasoning_level,
  supports_structured_output, supports_long_context, supports_tools,
  free_model, premium_model, input_cost, output_cost, context_window, priority
) values (
  'cloudflare', '@cf/meta/llama-3.1-8b-instruct-fp8',
  'Llama 3.1 8B FP8 on Cloudflare Workers AI', array[]::text[], 'standard',
  false, false, false, true, false, 0.152, 0.287, 32000, 45
)
on conflict (provider, model_id) do nothing;

update public.ai_feature_routes
set standard_provider_order = case
      when 'cloudflare' = any(standard_provider_order) then standard_provider_order
      else array_append(standard_provider_order, 'cloudflare')
    end,
    premium_provider_order = case
      when 'cloudflare' = any(premium_provider_order) then premium_provider_order
      else array_append(premium_provider_order, 'cloudflare')
    end
where not ('cloudflare' = any(standard_provider_order))
   or not ('cloudflare' = any(premium_provider_order));

commit;
