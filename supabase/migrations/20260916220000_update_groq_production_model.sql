-- Replace the Groq model retired for developer-tier accounts on 2026-08-16.
update public.ai_models
set enabled = false, updated_at = now()
where provider = 'groq' and model_id = 'llama-3.3-70b-versatile';

insert into public.ai_models (
  provider, model_id, display_name, task_types, reasoning_level,
  supports_structured_output, supports_long_context, supports_tools,
  free_model, premium_model, enabled,
  input_cost, output_cost, priority
)
values (
  'groq',
  'openai/gpt-oss-20b',
  'GPT-OSS 20B on Groq',
  array['company_classification','csv_column_mapping','campaign_generation','email_personalization','tender_summary','tender_extraction'],
  'standard', true, true, false, true, false, true, 0.075, 0.30, 10
)
on conflict (provider, model_id) do update set
  display_name = excluded.display_name,
  task_types = excluded.task_types,
  reasoning_level = excluded.reasoning_level,
  supports_structured_output = excluded.supports_structured_output,
  supports_long_context = excluded.supports_long_context,
  supports_tools = excluded.supports_tools,
  free_model = excluded.free_model,
  premium_model = excluded.premium_model,
  enabled = excluded.enabled,
  input_cost = excluded.input_cost,
  output_cost = excluded.output_cost,
  priority = excluded.priority,
  updated_at = now();
