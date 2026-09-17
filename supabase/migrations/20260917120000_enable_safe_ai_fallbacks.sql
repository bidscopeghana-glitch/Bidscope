begin;

update public.ai_feature_routes
set
  standard_provider_order = array['groq','gemini','openrouter','openai'],
  updated_at = now()
where task_type in ('tender_summary','tender_extraction');

commit;
