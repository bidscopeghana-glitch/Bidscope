begin;

create table if not exists public.ai_providers (
  id text primary key,
  display_name text not null,
  enabled boolean not null default true,
  role text not null default 'fallback' check (role in ('primary','secondary','fallback','premium')),
  secret_env_var text not null,
  health_status text not null default 'not_configured' check (health_status in ('active','degraded','rate_limited','offline','not_configured','invalid_key')),
  allow_sensitive_data boolean not null default false,
  allow_customer_documents boolean not null default false,
  data_retention_notes text,
  rate_limit_per_minute integer,
  priority integer not null default 100,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_models (
  id uuid primary key default gen_random_uuid(),
  provider text not null references public.ai_providers(id) on delete cascade,
  model_id text not null,
  display_name text not null,
  enabled boolean not null default true,
  task_types text[] not null default '{}',
  reasoning_level text not null default 'standard' check (reasoning_level in ('none','standard','advanced')),
  supports_structured_output boolean not null default false,
  supports_long_context boolean not null default false,
  supports_images boolean not null default false,
  supports_tools boolean not null default false,
  free_model boolean not null default false,
  premium_model boolean not null default false,
  input_cost numeric(14,8) not null default 0,
  output_cost numeric(14,8) not null default 0,
  context_window integer,
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider,model_id)
);

create table if not exists public.ai_feature_routes (
  id uuid primary key default gen_random_uuid(),
  task_type text not null unique,
  enabled boolean not null default true,
  standard_provider_order text[] not null default array['groq','gemini','openrouter'],
  premium_provider_order text[] not null default array['openai','gemini','openrouter'],
  standard_model_overrides jsonb not null default '{}',
  premium_model_overrides jsonb not null default '{}',
  minimum_complexity text not null default 'LOW',
  premium_allowed boolean not null default false,
  max_output_tokens integer not null default 1800,
  cache_ttl_seconds integer not null default 86400,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  organization_id uuid,
  task_type text not null,
  feature text,
  provider text,
  model text,
  complexity text,
  user_plan text,
  premium_reasoning boolean not null default false,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_usd numeric(14,8) not null default 0,
  cache_hit boolean not null default false,
  rule_engine_success boolean not null default false,
  fallback_count integer not null default 0,
  fallback_reason text,
  latency_ms integer,
  status text not null default 'succeeded',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_logs_created_idx on public.ai_usage_logs(created_at desc);
create index if not exists ai_usage_logs_user_idx on public.ai_usage_logs(user_id,created_at desc);
create index if not exists ai_usage_logs_provider_idx on public.ai_usage_logs(provider,created_at desc);

create table if not exists public.ai_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  task_type text not null,
  input_hash text not null,
  provider text,
  model text,
  result jsonb not null,
  structured_result jsonb,
  classification_version text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists ai_cache_lookup_idx on public.ai_cache(cache_key,expires_at);

create table if not exists public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  task_type text not null,
  user_id uuid,
  organization_id uuid,
  priority integer not null default 100,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed','retrying','cancelled')),
  provider text,
  model text,
  attempt_count integer not null default 0,
  next_attempt_at timestamptz,
  payload jsonb not null default '{}',
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);
create index if not exists ai_jobs_queue_idx on public.ai_jobs(status,priority,next_attempt_at,created_at);

create table if not exists public.company_ai_classifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  primary_sector text not null,
  secondary_sector text,
  procurement_category text,
  confidence numeric(5,4) not null,
  classification_method text not null check (classification_method in ('rule','existing_data','AI','manual')),
  provider text,
  model text,
  source_data_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,source_data_hash)
);

create table if not exists public.ai_budget_settings (
  singleton_key text primary key default 'default',
  daily_budget_usd numeric(12,2) not null default 10,
  monthly_budget_usd numeric(12,2) not null default 150,
  premium_daily_budget_usd numeric(12,2) not null default 5,
  maximum_tokens_per_task integer not null default 60000,
  warning_percent integer not null default 80 check (warning_percent between 1 and 100),
  provider_caps jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_user_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  organization_id uuid,
  period_start date not null,
  task_type text not null,
  standard_calls integer not null default 0,
  premium_calls integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  estimated_cost_usd numeric(14,8) not null default 0,
  updated_at timestamptz not null default now(),
  unique(user_id,period_start,task_type)
);

create table if not exists public.ai_provider_health (
  id uuid primary key default gen_random_uuid(),
  provider text not null references public.ai_providers(id) on delete cascade,
  status text not null,
  latency_ms integer not null default 0,
  failure_reason text,
  checked_at timestamptz not null default now()
);
create index if not exists ai_provider_health_latest_idx on public.ai_provider_health(provider,checked_at desc);

insert into public.ai_providers(id,display_name,role,secret_env_var,priority,allow_sensitive_data,allow_customer_documents,data_retention_notes) values
 ('groq','Groq','primary','GROQ_API_KEY',10,false,false,'Use only for routine, non-sensitive processing after reviewing current provider terms.'),
 ('gemini','Google Gemini','secondary','GOOGLE_GEMINI_API_KEY',20,false,true,'Web-grounded tender analysis is supported; customer documents require administrator approval.'),
 ('openrouter','OpenRouter','fallback','OPENROUTER_API_KEY',30,false,false,'Routing may involve downstream model providers; avoid sensitive documents by default.'),
 ('openai','OpenAI','premium','OPENAI_API_KEY',40,true,true,'Reserved for justified Premium and Platinum reasoning tasks.')
on conflict(id) do update set display_name=excluded.display_name,secret_env_var=excluded.secret_env_var;

insert into public.ai_models(provider,model_id,display_name,task_types,reasoning_level,supports_structured_output,supports_long_context,supports_tools,free_model,premium_model,priority) values
 ('groq','llama-3.3-70b-versatile','Llama 3.3 70B on Groq',array['company_classification','csv_column_mapping','campaign_generation','email_personalization','tender_summary','tender_extraction'],'standard',true,true,false,true,false,10),
 ('gemini','gemini-2.5-flash','Gemini 2.5 Flash',array['company_classification','campaign_generation','tender_summary','tender_extraction','deep_tender_analysis'],'standard',true,true,true,true,false,20),
 ('gemini','gemini-2.5-pro','Gemini 2.5 Pro',array['deep_tender_analysis','bid_no_bid','opportunity_comparison'],'advanced',true,true,true,false,true,10),
 ('openrouter','google/gemini-2.0-flash-001','OpenRouter Gemini Flash',array[]::text[],'standard',true,true,false,false,false,30),
 ('openai','gpt-4.1-mini','OpenAI GPT-4.1 mini',array['tender_summary','tender_extraction','campaign_generation'],'standard',true,true,true,false,false,40),
 ('openai','o3','OpenAI o3',array['deep_tender_analysis','bid_no_bid','opportunity_comparison'],'advanced',true,true,true,false,true,10)
on conflict(provider,model_id) do nothing;

insert into public.ai_feature_routes(task_type,standard_provider_order,premium_provider_order,minimum_complexity,premium_allowed,max_output_tokens,cache_ttl_seconds) values
 ('company_classification',array['groq','gemini','openrouter'],array['groq','gemini','openrouter'],'LOW',false,500,31536000),
 ('csv_column_mapping',array['groq','gemini','openrouter'],array['groq','gemini','openrouter'],'LOW',false,700,2592000),
 ('campaign_generation',array['groq','gemini','openrouter'],array['groq','gemini','openrouter'],'MEDIUM',false,1800,604800),
 ('tender_summary',array['groq','gemini','openrouter','openai'],array['groq','gemini','openrouter','openai'],'LOW',false,1800,86400),
 ('tender_extraction',array['groq','gemini','openrouter','openai'],array['groq','gemini','openrouter','openai'],'MEDIUM',false,2200,86400),
 ('deep_tender_analysis',array['gemini','groq','openrouter'],array['openai','gemini','openrouter'],'PREMIUM_REASONING',true,4000,86400),
 ('bid_no_bid',array['gemini','groq','openrouter'],array['openai','gemini','openrouter'],'PREMIUM_REASONING',true,3000,43200)
on conflict(task_type) do nothing;
insert into public.ai_budget_settings(singleton_key) values('default') on conflict do nothing;

alter table public.ai_providers enable row level security;
alter table public.ai_models enable row level security;
alter table public.ai_feature_routes enable row level security;
alter table public.ai_usage_logs enable row level security;
alter table public.ai_cache enable row level security;
alter table public.ai_jobs enable row level security;
alter table public.company_ai_classifications enable row level security;
alter table public.ai_budget_settings enable row level security;
alter table public.ai_user_usage enable row level security;
alter table public.ai_provider_health enable row level security;

do $$ declare t text; begin
  foreach t in array array['ai_providers','ai_models','ai_feature_routes','ai_usage_logs','ai_cache','ai_jobs','company_ai_classifications','ai_budget_settings','ai_user_usage','ai_provider_health'] loop
    execute format('drop policy if exists ai_admin_all on public.%I',t);
    execute format('create policy ai_admin_all on public.%I for all using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_super_admin=true)) with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_super_admin=true))',t);
  end loop;
end $$;
create policy ai_users_read_own_usage on public.ai_user_usage for select using(user_id=auth.uid());
create policy ai_users_read_own_logs on public.ai_usage_logs for select using(user_id=auth.uid());
create policy ai_users_read_own_jobs on public.ai_jobs for select using(user_id=auth.uid());

commit;
