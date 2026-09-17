-- Product-help AI is deliberately separated from paid tender evaluation.
insert into public.ai_feature_routes (
  task_type,
  standard_provider_order,
  premium_provider_order,
  minimum_complexity,
  premium_allowed,
  max_output_tokens,
  cache_ttl_seconds
) values (
  'help_assistant',
  array['groq','gemini','openrouter','openai'],
  array['groq','gemini','openrouter','openai'],
  'LOW',
  false,
  500,
  3600
)
on conflict (task_type) do update set
  standard_provider_order = excluded.standard_provider_order,
  premium_provider_order = excluded.premium_provider_order,
  minimum_complexity = excluded.minimum_complexity,
  premium_allowed = excluded.premium_allowed,
  max_output_tokens = excluded.max_output_tokens,
  cache_ttl_seconds = excluded.cache_ttl_seconds,
  enabled = true,
  updated_at = now();

update public.ai_models
set task_types = array_append(task_types, 'help_assistant'), updated_at = now()
where enabled = true
  and not ('help_assistant' = any(task_types));
