begin;

update public.ai_models
set
  model_id = 'gemini-3.1-pro-preview',
  display_name = 'Gemini 3.1 Pro Preview',
  updated_at = now()
where provider = 'gemini'
  and model_id = 'gemini-2.5-pro';

update public.ai_feature_routes
set
  standard_provider_order = array['gemini','groq','openrouter','openai'],
  premium_provider_order = case
    when premium_allowed then array['gemini','openai','openrouter','groq']
    else array['gemini','groq','openrouter','openai']
  end,
  updated_at = now()
where task_type in ('tender_summary','tender_extraction','deep_tender_analysis','bid_no_bid');

commit;
