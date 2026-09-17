begin;

update public.ai_models
set
  model_id = 'gemini-3.6-flash',
  display_name = 'Gemini 3.6 Flash',
  free_model = false,
  updated_at = now()
where provider = 'gemini'
  and model_id = 'gemini-2.5-flash';

commit;
