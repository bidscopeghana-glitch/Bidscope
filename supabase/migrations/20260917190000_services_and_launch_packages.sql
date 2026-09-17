begin;
-- Clone the existing entitlements; never change legacy customer prices or provider codes.
insert into public.billing_plans(code,tier,name,description,billing_interval,payment_kind,currency,amount_minor,provider_plan_code,features,limits,access_days,activation_status,enabled)
select split_part(p.code,'_',1)||'_launch_'||split_part(p.code,'_',2), p.tier,p.name,p.description,p.billing_interval,p.payment_kind,p.currency,
  case split_part(p.code,'_',1) when 'pro' then 15000 when 'premium' then 30000 else 60000 end * case when p.billing_interval='ANNUAL' then 10 else 1 end,
  null,p.features || '{"change_monitoring":true,"smart_alerts":true}'::jsonb,p.limits,p.access_days,'PRICING_CONFIGURATION_REQUIRED',false
from public.billing_plans p where p.code in ('pro_monthly','pro_annual','premium_monthly','premium_annual','platinum_monthly','platinum_annual')
on conflict(code) do nothing;
do $$ begin
 if (select count(*) from public.billing_plans where code in ('pro_launch_monthly','pro_launch_annual','premium_launch_monthly','premium_launch_annual','platinum_launch_monthly','platinum_launch_annual'))<>6 then
   raise exception 'The six existing Pro/Premium/Platinum plans must be configured before creating launch offers';
 end if;
end $$;

create table public.service_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 service_code text not null check(service_code in ('tender-review','company-profile','proposal-support','cv-preparation','market-research','training')),
 brief text not null check(length(brief) between 30 and 5000), deliverables jsonb not null default '[]',
 quantity integer not null default 1 check(quantity between 1 and 100), requested_date date,
 status text not null default 'REQUESTED' check(status in ('REQUESTED','QUOTED','ACCEPTED','IN_PROGRESS','COMPLETED','DECLINED')),
 version integer not null default 1, quote_scope text, quote_amount_minor bigint check(quote_amount_minor>0),
 quote_terms text, quote_expires_at timestamptz, turnaround_days integer check(turnaround_days between 1 and 365),
 accepted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(status not in ('QUOTED','ACCEPTED','IN_PROGRESS','COMPLETED') or (quote_scope is not null and quote_amount_minor is not null and quote_terms is not null and quote_expires_at is not null and turnaround_days is not null))
);
create index service_requests_owner_date on public.service_requests(user_id,created_at desc);
create table public.service_request_events (
 id bigint generated always as identity primary key, request_id uuid not null references public.service_requests(id),
 old_status text, new_status text not null, version integer not null, snapshot jsonb not null, created_at timestamptz not null default now()
);
alter table public.service_requests enable row level security;
alter table public.service_request_events enable row level security;
revoke all on public.service_requests,public.service_request_events from anon,authenticated,public;
grant select on public.service_requests to authenticated;
grant all on public.service_requests,public.service_request_events to service_role;
grant usage,select on sequence public.service_request_events_id_seq to service_role;
create policy services_owner_read on public.service_requests for select to authenticated using(user_id=auth.uid());
create function public.log_service_request_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.service_request_events(request_id,old_status,new_status,version,snapshot)
 values(new.id,case when TG_OP='UPDATE' then old.status else null end,new.status,new.version,to_jsonb(new));
 return new;
end $$;
revoke all on function public.log_service_request_change() from public,anon,authenticated;
create trigger service_request_history after insert or update on public.service_requests for each row execute function public.log_service_request_change();
commit;
