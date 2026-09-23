-- One shared, per-inbox UTC-day quota across both tender-email pipelines.
create table if not exists public.matching_tender_email_slots (
  delivery_key text primary key,
  recipient text not null,
  claimed_on date not null,
  slot smallint not null check (slot between 1 and 3),
  claimed_at timestamptz not null default now(),
  unique (recipient, claimed_on, slot)
);

create index if not exists matching_tender_email_slots_recipient_day_idx
  on public.matching_tender_email_slots (recipient, claimed_on);

alter table public.matching_tender_email_slots enable row level security;
revoke all on public.matching_tender_email_slots from anon, authenticated;
grant select, insert on public.matching_tender_email_slots to service_role;

create or replace function public.claim_matching_tender_email_slot(p_recipient text, p_delivery_key text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_recipient text := lower(btrim(p_recipient));
  v_day date := (now() at time zone 'UTC')::date;
  v_count integer;
begin
  if v_recipient is null or v_recipient = '' or p_delivery_key is null or p_delivery_key = '' then
    raise exception 'Recipient and delivery key are required';
  end if;
  perform pg_advisory_xact_lock(hashtext(v_recipient), hashtext(v_day::text));
  if exists (select 1 from public.matching_tender_email_slots where delivery_key = p_delivery_key) then
    return false;
  end if;
  select count(*) into v_count from public.matching_tender_email_slots
   where recipient = v_recipient and claimed_on = v_day;
  if v_count >= 3 then
    return false;
  end if;
  insert into public.matching_tender_email_slots (delivery_key, recipient, claimed_on, slot)
  values (p_delivery_key, v_recipient, v_day, v_count + 1);
  return true;
end;
$$;

revoke all on function public.claim_matching_tender_email_slot(text, text) from public, anon, authenticated;
grant execute on function public.claim_matching_tender_email_slot(text, text) to service_role;

-- Honour matching emails sent earlier on the day this migration is installed.
-- Existing rows beyond three are historical; only the first three occupy slots.
with sent as (
  select d.id::text as delivery_id, lower(btrim(recipient.email)) as recipient, d.sent_at
  from public.notification_deliveries d
  join public.notifications n on n.id = d.notification_id
  left join public.profiles p on p.id = n.user_id
  cross join lateral (
    select p.email
    union
    select value as email
      from jsonb_array_elements_text(case when jsonb_typeof(n.metadata->'deliveryRecipients') = 'array'
        then n.metadata->'deliveryRecipients' else '[]'::jsonb end)
  ) recipient
  where d.channel = 'email' and d.status = 'sent'
    and n.type in ('matching_tender', 'opportunity_match')
    and d.sent_at >= (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')
  union all
  select d.id::text, lower(btrim(d.recipient)), d.sent_at
  from public.alert_deliveries d
  where d.channel = 'email' and d.status = 'sent'
    and d.sent_at >= (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')
), ranked as (
  select recipient, delivery_id, row_number() over (partition by recipient order by sent_at, delivery_id) as slot
  from sent where recipient is not null and recipient <> ''
)
insert into public.matching_tender_email_slots (delivery_key, recipient, claimed_on, slot)
select 'backfill:' || delivery_id || ':' || recipient, recipient,
       (now() at time zone 'UTC')::date, slot
from ranked where slot <= 3
on conflict do nothing;
