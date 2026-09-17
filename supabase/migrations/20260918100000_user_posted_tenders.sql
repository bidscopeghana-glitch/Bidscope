create table if not exists public.tender_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  title text not null check (char_length(title) between 10 and 300),
  buyer_name text not null check (char_length(buyer_name) between 2 and 200),
  country text not null default 'Ghana', region text, city text,
  category text, industry text, description text not null check (char_length(description) between 30 and 12000),
  contract_type text, estimated_value numeric, value_min numeric, value_max numeric, currency text default 'GHS',
  publication_date date, clarification_deadline date, submission_deadline date, award_date date, start_date date, end_date date,
  duration text, eligibility text, certifications text, financial_requirements text, experience_requirements text, technical_requirements text,
  reference_number text, procurement_method text, contact_name text, contact_email text, contact_phone text,
  buyer_website text, tender_url text, submission_url text, submission_instructions text, additional_information text,
  tags text[] not null default '{}',
  status text not null default 'DRAFT' check (status in ('DRAFT','SUBMITTED','UNDER_REVIEW','NEEDS_CHANGES','APPROVED','PUBLISHED','REJECTED','EXPIRED','WITHDRAWN','ARCHIVED')),
  moderation_notes text, duplicate_warning jsonb, checklist jsonb not null default '{}'::jsonb,
  submitted_at timestamptz, reviewed_at timestamptz, published_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.tender_submission_documents (
  id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.tender_submissions(id) on delete cascade,
  storage_path text not null, original_filename text not null, mime_type text not null, size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  checksum text, status text not null default 'PENDING' check (status in ('PENDING','SCANNING','READY','REJECTED')), created_at timestamptz not null default now()
);

create table if not exists public.tender_moderation_events (
  id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.tender_submissions(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null, from_status text, to_status text not null, action text not null, note text,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create index if not exists tender_submissions_owner_idx on public.tender_submissions(submitted_by, created_at desc);
create index if not exists tender_submissions_review_idx on public.tender_submissions(status, created_at desc);
create index if not exists tender_submissions_reference_idx on public.tender_submissions(reference_number);
create index if not exists tender_submissions_title_idx on public.tender_submissions using gin (to_tsvector('simple', title || ' ' || buyer_name || ' ' || coalesce(description,'')));
create index if not exists tender_submission_documents_submission_idx on public.tender_submission_documents(submission_id);
create index if not exists tender_moderation_events_submission_idx on public.tender_moderation_events(submission_id, created_at desc);

alter table public.tender_submissions enable row level security;
alter table public.tender_submission_documents enable row level security;
alter table public.tender_moderation_events enable row level security;
drop policy if exists tender_submissions_owner_select on public.tender_submissions;
create policy tender_submissions_owner_select on public.tender_submissions for select using (submitted_by = auth.uid());
drop policy if exists tender_submissions_owner_insert on public.tender_submissions;
create policy tender_submissions_owner_insert on public.tender_submissions for insert with check (submitted_by = auth.uid() and status in ('DRAFT','SUBMITTED'));
drop policy if exists tender_submissions_owner_update on public.tender_submissions;
create policy tender_submissions_owner_update on public.tender_submissions for update using (submitted_by = auth.uid() and status in ('DRAFT','NEEDS_CHANGES')) with check (submitted_by = auth.uid() and status in ('DRAFT','SUBMITTED'));
drop policy if exists tender_submission_documents_owner_select on public.tender_submission_documents;
create policy tender_submission_documents_owner_select on public.tender_submission_documents for select using (exists (select 1 from public.tender_submissions s where s.id = submission_id and s.submitted_by = auth.uid()));
drop policy if exists tender_moderation_events_owner_select on public.tender_moderation_events;
create policy tender_moderation_events_owner_select on public.tender_moderation_events for select using (exists (select 1 from public.tender_submissions s where s.id = submission_id and s.submitted_by = auth.uid()));
