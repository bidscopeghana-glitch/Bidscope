begin;

-- Package-specific exact tender notifications. Free members receive the daily
-- workspace reminder, while paid packages receive increasingly broad and
-- numerous company-profile matches.
update public.billing_plans set limits=limits||'{"daily_tender_alerts":0,"alert_match_threshold":101}'::jsonb,updated_at=now() where code='free';
update public.billing_plans set limits=limits||'{"daily_tender_alerts":3,"alert_match_threshold":75}'::jsonb,updated_at=now() where code like 'pro%';
update public.billing_plans set limits=limits||'{"daily_tender_alerts":8,"alert_match_threshold":60}'::jsonb,updated_at=now() where code like 'premium%';
update public.billing_plans set limits=limits||'{"daily_tender_alerts":20,"alert_match_threshold":50}'::jsonb,updated_at=now() where code like 'platinum%';

-- New accounts start with useful daily email alerts enabled. Members retain
-- full control in Alert Centre and existing preferences are never overwritten.
create or replace function public.initialize_alert_preferences()
returns trigger language plpgsql security definer set search_path = public as $$
declare kind text;
begin
  foreach kind in array array['opportunity_match','tender_amendment','deadline','buyer_activity','award','supplier_activity','document_expiry','workspace_reminder','system'] loop
    insert into public.alert_preferences(user_id,alert_type,in_app_enabled,email_enabled,frequency,urgent_override,reminder_days)
    values(new.id,kind,true,kind in ('opportunity_match','tender_amendment','deadline','workspace_reminder'),'daily',kind in ('tender_amendment','deadline','document_expiry'),
      case when kind='deadline' then array[7,3,1] when kind='document_expiry' then array[30,14,7,1] else '{}'::integer[] end)
    on conflict(user_id,alert_type) do nothing;
  end loop;
  return new;
end;
$$;

-- Repair only missing rows for existing accounts; never re-enable an email
-- category a member has already switched off.
insert into public.alert_preferences(user_id,alert_type,in_app_enabled,email_enabled,frequency,urgent_override,reminder_days)
select u.id,kind,true,kind in ('opportunity_match','tender_amendment','deadline','workspace_reminder'),'daily',kind in ('tender_amendment','deadline','document_expiry'),
  case when kind='deadline' then array[7,3,1] when kind='document_expiry' then array[30,14,7,1] else '{}'::integer[] end
from auth.users u cross join unnest(array['opportunity_match','tender_amendment','deadline','buyer_activity','award','supplier_activity','document_expiry','workspace_reminder','system']) kind
on conflict(user_id,alert_type) do nothing;

commit;
