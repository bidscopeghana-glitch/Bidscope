begin;

update public.ai_models
set
  model_id = 'google/gemini-2.5-flash',
  display_name = 'OpenRouter Gemini 2.5 Flash',
  updated_at = now()
where provider = 'openrouter'
  and model_id = 'google/gemini-2.0-flash-001';

commit;
