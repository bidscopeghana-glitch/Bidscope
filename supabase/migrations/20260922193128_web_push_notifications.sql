begin;

alter table public.alert_preferences add column if not exists push_enabled boolean not null default true;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  browser text,
  platform text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  invalidated_at timestamptz,
  constraint push_endpoint_https check (endpoint ~ '^https://'),
  constraint push_key_lengths check (length(p256dh) between 40 and 300 and length(auth) between 8 and 300)
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id, enabled);
alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_own_read on public.push_subscriptions for select to authenticated using ((select auth.uid()) = user_id);
create policy push_subscriptions_own_insert on public.push_subscriptions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy push_subscriptions_own_update on public.push_subscriptions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy push_subscriptions_own_delete on public.push_subscriptions for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

create table if not exists public.push_event_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, event_key),
  constraint push_event_key_valid check (length(event_key) between 2 and 80)
);
alter table public.push_event_preferences enable row level security;
create policy push_event_preferences_own_read on public.push_event_preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy push_event_preferences_own_insert on public.push_event_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
create policy push_event_preferences_own_update on public.push_event_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy push_event_preferences_own_delete on public.push_event_preferences for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.push_event_preferences from anon;
grant select, insert, update, delete on public.push_event_preferences to authenticated;
grant all on public.push_event_preferences to service_role;

alter table public.notification_deliveries drop constraint if exists notification_deliveries_channel_check;
alter table public.notification_deliveries add constraint notification_deliveries_channel_check check (channel in ('in_app','email','whatsapp','sms','push'));

create table if not exists public.push_device_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','accepted','failed','expired')),
  attempts integer not null default 0 check (attempts between 0 and 10),
  response_status integer,
  attempted_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (notification_id, subscription_id)
);
create index if not exists push_device_deliveries_status_idx on public.push_device_deliveries(status, created_at);
alter table public.push_device_deliveries enable row level security;
revoke all on public.push_device_deliveries from anon, authenticated;
grant all on public.push_device_deliveries to service_role;

commit;
