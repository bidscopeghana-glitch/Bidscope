begin;

update public.ai_models
set
  model_id = 'openrouter/free',
  display_name = 'OpenRouter Free Model Router',
  free_model = true,
  input_cost = 0,
  output_cost = 0,
  updated_at = now()
where provider = 'openrouter'
  and model_id in ('google/gemini-2.0-flash-001', 'google/gemini-2.5-flash');

commit;
