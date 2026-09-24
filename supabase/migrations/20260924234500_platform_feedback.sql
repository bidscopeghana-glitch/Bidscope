create table if not exists public.platform_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  user_email text,
  category text not null check (category in ('GENERAL','TENDER_DATA','AI_ANALYSIS','ALERTS','BILLING','BUYER_WORKSPACE','TECHNICAL','FEATURE_REQUEST')),
  subject text not null check (char_length(subject) between 3 and 160),
  message text not null check (char_length(message) between 10 and 5000),
  rating smallint check (rating between 1 and 5),
  page_url text,
  status text not null default 'NEW' check (status in ('NEW','REVIEWING','RESOLVED','CLOSED')),
  priority text not null default 'NORMAL' check (priority in ('LOW','NORMAL','HIGH','URGENT')),
  admin_notes text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_feedback_status_created_idx on public.platform_feedback(status, created_at desc);
create index if not exists platform_feedback_user_created_idx on public.platform_feedback(user_id, created_at desc);

alter table public.platform_feedback enable row level security;
revoke all on public.platform_feedback from anon, authenticated;
grant all on public.platform_feedback to service_role;

drop trigger if exists platform_feedback_set_updated_at on public.platform_feedback;
create trigger platform_feedback_set_updated_at before update on public.platform_feedback for each row execute function public.set_updated_at();
