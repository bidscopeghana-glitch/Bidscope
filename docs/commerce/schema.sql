-- DRAFT ADDITIVE MIGRATION. Review and test against a restored staging database.
-- Not included in automatic supabase migrations: explicit review is required.
begin;
create schema commerce;
revoke all on schema commerce from public,anon;
grant usage on schema commerce to authenticated,service_role;
create table commerce.sources(
 id text primary key, name text not null, status text not null default 'unknown' check(status in('unknown','approved','prohibited')),
 permission_evidence text, permission_expires_at timestamptz, product_publication boolean not null default false, media_publication boolean not null default false,
 approved_countries text[] not null default '{}', terms_url text, reviewed_at timestamptz,
 check(status<>'approved' or (nullif(btrim(permission_evidence),'') is not null and permission_expires_at is not null))
);
insert into commerce.sources(id,name,terms_url) values('cj','CJdropshipping','https://cjdropshipping.com/user-agreement/en'),('alibaba','Alibaba.com authorised integration','https://openapi.alibaba.com/doc/doc.htm');
create table commerce.products(
 id uuid primary key default gen_random_uuid(), source_id text not null references commerce.sources, supplier_product_id text not null,
 title text not null, description text not null default '', category text not null, origin_country text,
 publication_status text not null default 'draft' check(publication_status in('draft','approved','held','retired')),
 permission_evidence text, media jsonb not null default '[]', kind text not null check(kind in('retail','quote')),
 synced_at timestamptz, unique(source_id,supplier_product_id),unique(id,source_id)
);
create table commerce.variants(
 id uuid primary key default gen_random_uuid(), product_id uuid not null,source_id text not null references commerce.sources,
 supplier_variant_id text not null, options jsonb not null, cost_minor bigint not null check(cost_minor>=0),
 cost_currency text not null, stock integer not null default 0 check(stock>=0), stock_checked_at timestamptz,
 foreign key(product_id,source_id) references commerce.products(id,source_id),unique(source_id,supplier_variant_id)
);
create table commerce.orders(
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references auth.users,
 merchant_reference text not null unique, mode text not null default 'sandbox' check(mode='sandbox'),
 status text not null default 'awaiting_payment' check(status in('awaiting_payment','payment_review','paid','supplier_payment_pending','exception','partially_shipped','shipped','delivered','cancellation_requested','return_requested','refund_pending','refunded')),
 currency text not null check(currency='GHS'), total_minor bigint not null check(total_minor>0),
 supplier_cost_minor bigint not null check(supplier_cost_minor>=0), shipping_minor bigint not null check(shipping_minor>=0), fee_minor bigint not null check(fee_minor>=0), duty_minor bigint,
 pricing_snapshot jsonb not null, shipping_quote jsonb not null, quote_expires_at timestamptz not null, created_at timestamptz not null default now()
);
create table commerce.order_lines(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references commerce.orders,variant_id uuid not null references commerce.variants,
 quantity integer not null check(quantity>0), unit_price_minor bigint not null check(unit_price_minor>=0),
 supplier_mapping_snapshot jsonb not null,unique(order_id,variant_id)
);
create table commerce.customer_payments(
 reference text primary key, order_id uuid not null references commerce.orders, provider text not null check(provider='paystack'),
 amount_minor bigint not null check(amount_minor>0), currency text not null, verified_at timestamptz, status text not null check(status in('pending','verified','review','failed','refunded'))
);
create unique index one_verified_customer_payment on commerce.customer_payments(order_id) where status='verified';
create table commerce.supplier_orders(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references commerce.orders,source_id text not null references commerce.sources,
 merchant_reference text not null unique,provider_order_id text, status text not null, unique(source_id,provider_order_id),unique(order_id,source_id)
);
create table commerce.supplier_payments(
 id uuid primary key default gen_random_uuid(),supplier_order_id uuid not null references commerce.supplier_orders,
 reference text not null unique, amount_minor bigint not null check(amount_minor>=0),currency text not null,status text not null check(status in('pending','paid','failed','refunded')),
 verified_at timestamptz
);
create table commerce.shipments(
 id uuid primary key default gen_random_uuid(),supplier_order_id uuid not null references commerce.supplier_orders,
 provider_shipment_id text not null,carrier text,tracking_number text,status text not null,unique(supplier_order_id,provider_shipment_id)
);
create table commerce.shipment_lines(
 shipment_id uuid not null references commerce.shipments,order_line_id uuid not null references commerce.order_lines,quantity integer not null check(quantity>0),primary key(shipment_id,order_line_id)
);
create table commerce.refunds(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references commerce.orders,reference text not null unique,
 amount_minor bigint not null check(amount_minor>0),reason text not null,status text not null check(status in('requested','approved','pending','confirmed','failed')),provider_reference text unique
);
create table commerce.jobs(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references commerce.orders,kind text not null,
 idempotency_key text not null unique,payload jsonb not null default '{}',status text not null default 'pending' check(status in('pending','processing','done','exception')),
 attempts integer not null default 0 check(attempts between 0 and 5),available_at timestamptz not null default now(),lease_until timestamptz,last_error text
);
create table commerce.audit(
 id uuid primary key default gen_random_uuid(),actor_id uuid,entity_type text not null,entity_id text not null,action text not null,details jsonb not null default '{}',created_at timestamptz not null default now()
);
create table commerce.support(
 id uuid primary key default gen_random_uuid(),customer_id uuid not null references auth.users,order_id uuid references commerce.orders,
 kind text not null check(kind in('support','quote','cancellation','return')),message text not null,status text not null default 'open',created_at timestamptz not null default now()
);
create function commerce.check_publication() returns trigger language plpgsql set search_path=commerce,pg_temp as $$
declare source commerce.sources;
begin
 if new.publication_status='approved' then
  select * into source from commerce.sources where id=new.source_id;
  if source.status<>'approved' or not source.product_publication or source.permission_expires_at<=now() or source.permission_expires_at is null then raise exception 'Catalogue source rights are not current';end if;
  if jsonb_typeof(new.media)<>'array' then raise exception 'Media must be an array';end if;
  if jsonb_array_length(new.media)>0 and not source.media_publication then raise exception 'Media publication is not authorised';end if;
 end if;
 return new;
end $$;
create trigger product_publication_guard before insert or update on commerce.products for each row execute function commerce.check_publication();
create function commerce.claim_jobs(p_limit integer default 10)
returns setof commerce.jobs language sql security definer set search_path=commerce,pg_temp as $$
 update commerce.jobs j set status='processing',attempts=j.attempts+1,lease_until=now()+interval '60 seconds'
 where j.id in(select id from commerce.jobs where status='pending' and attempts<5 and available_at<=now() order by available_at,id for update skip locked limit least(greatest(p_limit,1),100))
 returning j.*
$$;
revoke all on function commerce.claim_jobs(integer) from public,anon,authenticated;
grant execute on function commerce.claim_jobs(integer) to service_role;
-- Service APIs perform writes; customers can only read their own order records.
do $$ declare t text; begin
 foreach t in array array['sources','products','variants','orders','order_lines','customer_payments','supplier_orders','supplier_payments','shipments','shipment_lines','refunds','jobs','audit','support'] loop
 execute format('alter table commerce.%I enable row level security',t);
 execute format('revoke all on commerce.%I from public,anon,authenticated',t);
 execute format('grant all on commerce.%I to service_role',t);
 end loop;
end $$;
grant select on commerce.orders,commerce.order_lines,commerce.shipments,commerce.shipment_lines,commerce.refunds,commerce.support to authenticated;
create policy own_orders on commerce.orders for select to authenticated using(customer_id=auth.uid());
create policy own_lines on commerce.order_lines for select to authenticated using(exists(select 1 from commerce.orders o where o.id=order_id and o.customer_id=auth.uid()));
create policy own_refunds on commerce.refunds for select to authenticated using(exists(select 1 from commerce.orders o where o.id=order_id and o.customer_id=auth.uid()));
create policy own_support on commerce.support for select to authenticated using(customer_id=auth.uid());
-- Shipments are deliberately API-only until a restricted join/view is reviewed;
-- supplier order costs and balances must never be disclosed by direct queries.
create function commerce.record_verified_payment(p_order uuid,p_reference text,p_amount bigint,p_currency text)
returns text language plpgsql security definer set search_path=commerce,pg_temp as $$
declare o commerce.orders; previous commerce.customer_payments; next_status text;
begin
 select * into o from commerce.orders where id=p_order for update;
 if not found then raise exception 'Order not found'; end if;
 select * into previous from commerce.customer_payments where reference=p_reference;
 if found then
  if previous.order_id<>p_order or previous.amount_minor<>p_amount or previous.currency<>p_currency then raise exception 'Payment reference collision';end if;
  return previous.status;
 end if;
 next_status:=case when o.status='awaiting_payment' and o.total_minor=p_amount and o.currency=p_currency and o.quote_expires_at>now() then 'verified' else 'review' end;
 insert into commerce.customer_payments values(p_reference,p_order,'paystack',p_amount,p_currency,now(),next_status);
 update commerce.orders set status=case when next_status='verified' then 'paid' else 'payment_review' end where id=p_order;
 if next_status='verified' then
  insert into commerce.jobs(order_id,kind,idempotency_key) values(p_order,'fulfilment','fulfil:'||p_order::text) on conflict(idempotency_key) do nothing;
 end if;
 insert into commerce.audit(entity_type,entity_id,action,details) values('order',p_order::text,'payment_'||next_status,jsonb_build_object('reference',p_reference));
 return next_status;
end $$;
revoke all on function commerce.record_verified_payment(uuid,text,bigint,text) from public,anon,authenticated;
grant execute on function commerce.record_verified_payment(uuid,text,bigint,text) to service_role;
-- Caller MUST first verify signed webhook and fetch payment from Paystack.
-- No scheduler is activated and no provider order writes run from this migration.
commit;
