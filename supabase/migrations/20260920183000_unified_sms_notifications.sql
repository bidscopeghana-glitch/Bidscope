begin;

alter table public.alert_preferences drop constraint if exists alert_preferences_alert_type_check;
alter table public.alert_preferences add constraint alert_preferences_alert_type_check check (alert_type in (
  'opportunity_match','tender_amendment','deadline','buyer_activity','award','supplier_activity','document_expiry','workspace_reminder','system',
  'bid_received','meeting_reminder','bid_awarded','otp_verification','matching_tender','watched_tender_closing'
));
alter table public.alert_preferences add column if not exists sms_enabled boolean not null default false;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'opportunity_match','tender_amendment','deadline','buyer_activity','award','supplier_activity','document_expiry','workspace_reminder','system',
  'bid_received','meeting_reminder','bid_awarded','otp_verification','matching_tender','watched_tender_closing'
));

alter table public.notification_deliveries drop constraint if exists notification_deliveries_channel_check;
alter table public.notification_deliveries add constraint notification_deliveries_channel_check check (channel in ('in_app','email','whatsapp','sms'));
alter table public.notification_deliveries drop constraint if exists notification_deliveries_status_check;
alter table public.notification_deliveries add constraint notification_deliveries_status_check check (status in ('pending','processing','sent','delivered','failed','skipped','cancelled'));

alter table public.profiles add column if not exists phone_e164 text;
alter table public.profiles add column if not exists phone_verified_at timestamptz;
create unique index if not exists profiles_phone_e164_unique on public.profiles(phone_e164) where phone_e164 is not null;

create table if not exists public.phone_verification_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_e164 text not null,
  code_hash text not null,
  request_ip_hash text,
  attempts integer not null default 0 check (attempts between 0 and 5),
  expires_at timestamptz not null,
  resend_after timestamptz not null,
  verified_at timestamptz,
  invalidated_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists phone_verification_user_created_idx on public.phone_verification_codes(user_id,created_at desc);
create index if not exists phone_verification_ip_created_idx on public.phone_verification_codes(request_ip_hash,created_at desc) where request_ip_hash is not null;
alter table public.phone_verification_codes enable row level security;
revoke all on public.phone_verification_codes from anon,authenticated;
grant all on public.phone_verification_codes to service_role;

create table if not exists public.sms_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications(id) on delete set null,
  delivery_id uuid references public.notification_deliveries(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('bid_received','meeting_reminder','bid_awarded','otp_verification','matching_tender','watched_tender_closing')),
  provider text not null default 'arkesel',
  recipient_masked text not null,
  status text not null default 'queued' check (status in ('queued','sending','sent','delivered','failed','cancelled')),
  provider_message_id text,
  error_code text,
  error_message text,
  dedupe_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists sms_delivery_logs_user_created_idx on public.sms_delivery_logs(user_id,created_at desc);
create index if not exists sms_delivery_logs_provider_message_idx on public.sms_delivery_logs(provider_message_id) where provider_message_id is not null;
create index if not exists sms_delivery_logs_status_idx on public.sms_delivery_logs(status,created_at desc);
alter table public.sms_delivery_logs enable row level security;
create policy sms_delivery_logs_owner_read on public.sms_delivery_logs for select to authenticated using (user_id=auth.uid());
revoke all on public.sms_delivery_logs from anon;
grant select on public.sms_delivery_logs to authenticated;
grant all on public.sms_delivery_logs to service_role;
drop trigger if exists sms_delivery_logs_set_updated_at on public.sms_delivery_logs;
create trigger sms_delivery_logs_set_updated_at before update on public.sms_delivery_logs for each row execute function public.set_updated_at();

create or replace function public.initialize_alert_preferences()
returns trigger language plpgsql security definer set search_path=public as $$
declare kind text;
begin
  foreach kind in array array[
    'opportunity_match','tender_amendment','deadline','buyer_activity','award','supplier_activity','document_expiry','workspace_reminder','system',
    'bid_received','meeting_reminder','bid_awarded','otp_verification','matching_tender','watched_tender_closing'
  ] loop
    insert into public.alert_preferences(user_id,alert_type,in_app_enabled,email_enabled,sms_enabled,frequency,urgent_override,reminder_days)
    values(
      new.id,kind,
      kind <> 'otp_verification',
      kind in ('opportunity_match','tender_amendment','deadline','workspace_reminder','bid_received','meeting_reminder','bid_awarded','matching_tender','watched_tender_closing'),
      kind in ('bid_awarded','otp_verification'),
      case when kind in ('bid_received','meeting_reminder','bid_awarded','otp_verification','watched_tender_closing') then 'instant' else 'daily' end,
      kind in ('tender_amendment','deadline','document_expiry','bid_received','meeting_reminder','bid_awarded','otp_verification','watched_tender_closing'),
      case when kind='deadline' then array[7,3,1] when kind='document_expiry' then array[30,14,7,1] when kind='watched_tender_closing' then array[1] else '{}'::integer[] end
    ) on conflict(user_id,alert_type) do nothing;
  end loop;
  return new;
end;
$$;

revoke all on function public.initialize_alert_preferences() from public, anon, authenticated;
grant execute on function public.initialize_alert_preferences() to service_role;

insert into public.alert_preferences(user_id,alert_type,in_app_enabled,email_enabled,sms_enabled,frequency,urgent_override,reminder_days)
select u.id,kind,kind <> 'otp_verification',kind <> 'otp_verification',false,'instant',true,
  case when kind='watched_tender_closing' then array[1] else '{}'::integer[] end
from auth.users u cross join unnest(array['bid_received','meeting_reminder','bid_awarded','otp_verification','matching_tender','watched_tender_closing']) kind
on conflict(user_id,alert_type) do nothing;

commit;
