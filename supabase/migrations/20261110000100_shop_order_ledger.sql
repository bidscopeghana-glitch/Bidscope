-- Additive order ledger. No tender/subscription data or settings are changed.
begin;
-- Longer bounded quote reviews share the already-private CJ admission gate.
create or replace function public.bidscope_cj_review_acquire(p_lease uuid) returns boolean
language plpgsql security definer set search_path=pg_catalog,public as $$
declare acquired boolean;
begin
 if p_lease is null then return false;end if;
 update public.bidscope_cj_review_gate set lease=p_lease,available_at=clock_timestamp()+interval '210 seconds'
 where id=true and available_at<=clock_timestamp() returning true into acquired;
 return coalesce(acquired,false);
end $$;
create table public.bidscope_shop_quotes(
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references auth.users(id),
 mode text not null check(mode in('test','live')), sale_ready boolean not null default false,
 merchandise_minor bigint not null check(merchandise_minor>=0),shipping_minor bigint not null check(shipping_minor>=0),
 included_tax_minor bigint not null default 0 check(included_tax_minor>=0),customer_fee_minor bigint not null default 0 check(customer_fee_minor=0),
 total_minor bigint not null check(total_minor between 1 and 100000000),currency text not null default 'GHS' check(currency='GHS'),
 import_charges_policy text not null default 'customer_pays_excluded' check(import_charges_policy='customer_pays_excluded'),
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 5),
 fulfilment_snapshot jsonb not null,delivery_address jsonb not null,
 created_at timestamptz not null default now(),expires_at timestamptz not null,
 check(total_minor=merchandise_minor+shipping_minor+included_tax_minor+customer_fee_minor),
 check(expires_at>created_at and expires_at<=created_at+interval '10 minutes')
);
create table public.bidscope_shop_orders(
 id uuid primary key default gen_random_uuid(),customer_id uuid not null references auth.users(id),
 quote_id uuid not null unique references public.bidscope_shop_quotes(id),request_key uuid not null,
 payment_reference text not null unique,payment_mode text not null check(payment_mode in('test','live')),
 status text not null default 'awaiting_payment' check(status in('awaiting_payment','payment_review','paid','supplier_payment_pending','exception','partially_shipped','shipped','delivered','cancellation_requested','return_requested','refund_pending','refunded','cancelled')),
 currency text not null check(currency='GHS'),total_minor bigint not null check(total_minor between 1 and 100000000),
 shipping_minor bigint not null check(shipping_minor>=0),customer_fee_minor bigint not null check(customer_fee_minor=0),
 import_charges_policy text not null check(import_charges_policy='customer_pays_excluded'),
 items jsonb not null,fulfilment_snapshot jsonb not null,delivery_address jsonb not null,
 shipments jsonb not null default '[]' check(jsonb_typeof(shipments)='array'),
 quote_expires_at timestamptz not null,created_at timestamptz not null default now(),
 provider_transaction text unique,verified_at timestamptz,unique(customer_id,request_key),
 received_amount_minor bigint,received_currency text,received_mode text,
 payment_init_status text not null default 'not_started' check(payment_init_status in('not_started','initializing','ready','review')),
 checkout_url text,
 check(payment_reference like case when payment_mode='test' then 'BSC-SBX-%' else 'BSC-LIVE-%' end)
);
create index bidscope_shop_orders_customer on public.bidscope_shop_orders(customer_id,created_at desc);
create table public.bidscope_shop_jobs(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.bidscope_shop_orders(id),
 kind text not null check(kind in('fulfilment','payment_review','tracking','refund')),
 status text not null default 'pending' check(status in('pending','processing','done','exception')),
 attempts integer not null default 0 check(attempts between 0 and 5),available_at timestamptz not null default now(),
 lease_until timestamptz,last_error text,created_at timestamptz not null default now(),unique(order_id,kind)
);
create table public.bidscope_shop_audit(
 id bigint generated always as identity primary key,order_id uuid references public.bidscope_shop_orders(id),
 action text not null,details jsonb not null default '{}',created_at timestamptz not null default now()
);
create table public.bidscope_shop_requests(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.bidscope_shop_orders(id),
 customer_id uuid not null references auth.users(id),request_key uuid not null,
 kind text not null check(kind in('cancellation','return','support')),message text not null check(length(message) between 1 and 3000),
 status text not null default 'open' check(status in('open','reviewing','resolved','declined')),
 created_at timestamptz not null default now(),unique(customer_id,request_key)
);
do $$ declare t text; begin
 foreach t in array array['bidscope_shop_quotes','bidscope_shop_orders','bidscope_shop_jobs','bidscope_shop_audit','bidscope_shop_requests'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant usage,select on sequence public.bidscope_shop_audit_id_seq to service_role;

create function public.bidscope_shop_create_order(p_customer uuid,p_quote uuid,p_key uuid) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $$
declare q public.bidscope_shop_quotes; o public.bidscope_shop_orders; result uuid;
begin
 if p_customer is null or p_quote is null or p_key is null then raise exception 'Missing order identity'; end if;
 -- Serialize both same-key and same-quote attempts, including concurrent requests.
 perform pg_advisory_xact_lock(hashtextextended(p_customer::text||':'||p_key::text,0));
 select * into o from public.bidscope_shop_orders where customer_id=p_customer and request_key=p_key;
 if found then
  if o.quote_id<>p_quote then raise exception 'Order key conflict'; end if;
  return o.id;
 end if;
 select * into q from public.bidscope_shop_quotes where id=p_quote and customer_id=p_customer for update;
 if not found then raise exception 'Quote not found';end if;
 select * into o from public.bidscope_shop_orders where quote_id=p_quote;
 if found then raise exception 'Quote already has an order; use its original request key';end if;
 if q.expires_at<=clock_timestamp() then raise exception 'Quote expired';end if;
 if q.mode='live' and not q.sale_ready then raise exception 'Quote not approved for live sale';end if;
 result:=gen_random_uuid();
 insert into public.bidscope_shop_orders(id,customer_id,quote_id,request_key,payment_reference,payment_mode,currency,total_minor,shipping_minor,customer_fee_minor,import_charges_policy,items,fulfilment_snapshot,delivery_address,quote_expires_at)
 values(result,p_customer,q.id,p_key,case when q.mode='test' then 'BSC-SBX-' else 'BSC-LIVE-' end||result::text,q.mode,q.currency,q.total_minor,q.shipping_minor,q.customer_fee_minor,q.import_charges_policy,q.items,q.fulfilment_snapshot,q.delivery_address,q.expires_at);
 insert into public.bidscope_shop_audit(order_id,action) values(result,'order_created');
 return result;
end $$;

create function public.bidscope_shop_record_payment(p_reference text,p_transaction text,p_amount bigint,p_currency text,p_mode text) returns text
language plpgsql security definer set search_path=pg_catalog,public as $$
declare o public.bidscope_shop_orders; outcome text;
begin
 select * into o from public.bidscope_shop_orders where payment_reference=p_reference for update;
 if not found then raise exception 'Order not found';end if;
 if p_transaction is null or p_transaction !~ '^[0-9]{1,30}$' or p_amount is null or p_amount<1 or p_currency is null or p_currency !~ '^[A-Z]{3}$' or p_mode is null or p_mode not in('test','live') then raise exception 'Invalid provider transaction';end if;
 if o.provider_transaction is not null then
  if o.provider_transaction<>p_transaction or o.received_amount_minor<>p_amount or o.received_currency<>p_currency or o.received_mode<>p_mode then raise exception 'Payment collision';end if;
  return o.status;
 end if;
 outcome:=case when o.status='awaiting_payment' and o.total_minor=p_amount and o.currency=p_currency and o.payment_mode=p_mode and o.quote_expires_at>clock_timestamp() then 'paid' else 'payment_review' end;
 update public.bidscope_shop_orders set provider_transaction=p_transaction,received_amount_minor=p_amount,received_currency=p_currency,received_mode=p_mode,verified_at=clock_timestamp(),status=outcome where id=o.id;
 insert into public.bidscope_shop_jobs(order_id,kind) values(o.id,case when outcome='paid' then 'fulfilment' else 'payment_review' end) on conflict(order_id,kind) do nothing;
 insert into public.bidscope_shop_audit(order_id,action,details) values(o.id,outcome,jsonb_build_object('provider_transaction',p_transaction));
 return outcome;
end $$;
revoke all on function public.bidscope_shop_create_order(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.bidscope_shop_record_payment(text,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.bidscope_shop_create_order(uuid,uuid,uuid) to service_role;
grant execute on function public.bidscope_shop_record_payment(text,text,bigint,text,text) to service_role;
create function public.bidscope_shop_request(p_customer uuid,p_order uuid,p_key uuid,p_kind text,p_message text) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $$
declare o public.bidscope_shop_orders; previous public.bidscope_shop_requests; result uuid;
begin
 if p_customer is null or p_order is null or p_key is null or p_kind is null or p_kind not in('cancellation','return','support') or p_message is null or length(btrim(p_message)) not between 1 and 3000 then raise exception 'Invalid request';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_customer::text||':'||p_key::text,0));
 select * into previous from public.bidscope_shop_requests where customer_id=p_customer and request_key=p_key;
 if found then
  if previous.order_id<>p_order or previous.kind<>p_kind or previous.message<>btrim(p_message) then raise exception 'Request key conflict';end if;
  return previous.id;
 end if;
 select * into o from public.bidscope_shop_orders where id=p_order and customer_id=p_customer for update;
 if not found then raise exception 'Order not found';end if;
 if p_kind='cancellation' and o.status not in('awaiting_payment','payment_review','paid','supplier_payment_pending','exception','cancellation_requested') then raise exception 'Use support for this order';end if;
 if p_kind='return' and o.status not in('partially_shipped','shipped','delivered','return_requested') then raise exception 'Return request unavailable for this order';end if;
 insert into public.bidscope_shop_requests(customer_id,order_id,request_key,kind,message) values(p_customer,p_order,p_key,p_kind,btrim(p_message)) returning id into result;
 if p_kind<>'support' then
  update public.bidscope_shop_orders set status=case when p_kind='cancellation' then 'cancellation_requested' else 'return_requested' end where id=o.id;
 end if;
 insert into public.bidscope_shop_audit(order_id,action,details) values(o.id,'customer_request',jsonb_build_object('kind',p_kind,'request_id',result));
 return result;
end $$;
revoke all on function public.bidscope_shop_request(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.bidscope_shop_request(uuid,uuid,uuid,text,text) to service_role;
create function public.bidscope_shop_begin_payment(p_order uuid,p_customer uuid) returns boolean
language plpgsql security definer set search_path=pg_catalog,public as $$
declare claimed boolean;
begin
 update public.bidscope_shop_orders set payment_init_status='initializing'
 where id=p_order and customer_id=p_customer and payment_mode='test' and status='awaiting_payment'
 and quote_expires_at>clock_timestamp() and payment_init_status='not_started' returning true into claimed;
 return coalesce(claimed,false);
end $$;
revoke all on function public.bidscope_shop_begin_payment(uuid,uuid) from public,anon,authenticated;
grant execute on function public.bidscope_shop_begin_payment(uuid,uuid) to service_role;
commit;
