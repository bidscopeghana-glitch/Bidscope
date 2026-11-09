-- Additive, sandbox-only supplier and refund ledgers. No live purchases enabled.
begin;
create table public.bidscope_shop_supplier_orders(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.bidscope_shop_orders(id),
 line_index integer not null check(line_index between 0 and 4),merchant_reference text not null unique,
 provider_order_id text unique,is_sandbox boolean not null default true check(is_sandbox),
 state text not null default 'awaiting_creation' check(state in('awaiting_creation','submitting','created','supplier_payment_pending','processing','shipped','delivered','exception')),
 supplier_payment_state text not null default 'unpaid' check(supplier_payment_state in('unpaid','simulated_paid')),
 provider_status text,tracking_number text,carrier text,payload jsonb not null,
 write_attempted boolean not null default false,
 last_error text,updated_at timestamptz not null default now(),unique(order_id,line_index)
);
create table public.bidscope_shop_refunds(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.bidscope_shop_orders(id),
 request_key uuid not null,reference text not null unique,amount_minor bigint not null check(amount_minor>0),
 mode text not null default 'test' check(mode='test'),status text not null default 'reserved' check(status in('reserved','submitting','pending','processing','processed','failed','needs_attention','exception')),
 provider_refund_id text unique,reason text not null check(length(reason) between 1 and 1000),
 previous_order_status text not null,last_error text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(order_id,request_key)
);
alter table public.bidscope_shop_supplier_orders enable row level security;
alter table public.bidscope_shop_refunds enable row level security;
revoke all on public.bidscope_shop_supplier_orders,public.bidscope_shop_refunds from public,anon,authenticated;
grant all on public.bidscope_shop_supplier_orders,public.bidscope_shop_refunds to service_role;

create function public.bidscope_shop_prepare_supplier(p_order uuid) returns integer
language plpgsql security definer set search_path=pg_catalog,public as $$
declare o public.bidscope_shop_orders; line jsonb; idx integer:=0; n integer;
begin
 select * into o from public.bidscope_shop_orders where id=p_order for update;
 if not found or o.payment_mode<>'test' or o.status not in('paid','supplier_payment_pending','exception') or o.verified_at is null or o.provider_transaction is null or o.received_amount_minor is distinct from o.total_minor or o.received_currency is distinct from 'GHS' or o.received_mode is distinct from 'test' then raise exception 'Verified sandbox payment required';end if;
 if coalesce(jsonb_typeof(o.fulfilment_snapshot->'lines'),'')<>'array' or jsonb_array_length(o.fulfilment_snapshot->'lines') not between 1 and 5 then raise exception 'Invalid fulfilment plan';end if;
 for line in select value from jsonb_array_elements(o.fulfilment_snapshot->'lines') loop
  insert into public.bidscope_shop_supplier_orders(order_id,line_index,merchant_reference,payload)
  values(o.id,idx,'BIDSCOPE-SANDBOX-'||substr(md5(o.id::text||':'||idx::text),1,24),line) on conflict(order_id,line_index) do nothing;
  idx:=idx+1;
 end loop;
 select count(*) into n from public.bidscope_shop_supplier_orders where order_id=o.id;
 return n;
end $$;
create function public.bidscope_shop_claim_supplier(p_supplier uuid) returns boolean
language plpgsql security definer set search_path=pg_catalog,public as $$
declare o public.bidscope_shop_orders; s public.bidscope_shop_supplier_orders; claimed boolean;
begin
 select * into s from public.bidscope_shop_supplier_orders where id=p_supplier;
 if not found then return false;end if;
 select * into o from public.bidscope_shop_orders where id=s.order_id for update;
 if o.payment_mode<>'test' or o.status not in('paid','supplier_payment_pending','exception') or o.received_amount_minor is distinct from o.total_minor or o.received_mode is distinct from 'test' or o.received_currency is distinct from 'GHS' or o.verified_at is null then return false;end if;
 update public.bidscope_shop_supplier_orders set state='submitting',updated_at=clock_timestamp() where id=s.id and state='awaiting_creation' returning true into claimed;
 if coalesce(claimed,false) then
  update public.bidscope_shop_jobs set status='processing',attempts=least(attempts+1,5),lease_until=clock_timestamp()+interval '180 seconds' where order_id=o.id and kind='fulfilment';
  insert into public.bidscope_shop_audit(order_id,action,details) values(o.id,'sandbox_supplier_write_claimed',jsonb_build_object('supplier_id',s.id));
 end if;
 return coalesce(claimed,false);
end $$;
create function public.bidscope_shop_sync_supplier(p_supplier uuid,p_provider text,p_status text,p_tracking text,p_carrier text) returns text
language plpgsql security definer set search_path=pg_catalog,public as $$
declare s public.bidscope_shop_supplier_orders; o public.bidscope_shop_orders; next_state text; all_delivered boolean; all_shipped boolean; any_shipped boolean; all_created boolean; any_exception boolean;
begin
 select * into s from public.bidscope_shop_supplier_orders where id=p_supplier;
 if not found or not s.is_sandbox then raise exception 'Sandbox supplier order not found';end if;
 select * into o from public.bidscope_shop_orders where id=s.order_id for update;
 select * into s from public.bidscope_shop_supplier_orders where id=p_supplier for update;
 if o.payment_mode<>'test' or p_provider is null or length(p_provider) not between 1 and 200 or (s.provider_order_id is not null and s.provider_order_id<>p_provider) then raise exception 'Supplier mapping mismatch';end if;
 next_state:=case when p_status in('CREATED','IN_CART') then 'created' when p_status='UNPAID' then 'supplier_payment_pending' when p_status in('PENDING','PROCESSING','UNSHIPPED') then 'processing' when p_status='SHIPPED' then 'shipped' when p_status='DELIVERED' then 'delivered' else null end;
 if next_state is null then raise exception 'Unsupported supplier status';end if;
 -- Older polls must not regress confirmed shipments or remove tracking.
 if s.state='delivered' then return o.status;end if;
 if s.state='shipped' and next_state not in('shipped','delivered') then return o.status;end if;
 if s.state='processing' and next_state in('created','supplier_payment_pending') then return o.status;end if;
 update public.bidscope_shop_supplier_orders set provider_order_id=p_provider,state=next_state,provider_status=p_status,
 supplier_payment_state=case when next_state in('processing','shipped','delivered') then 'simulated_paid' else supplier_payment_state end,
 tracking_number=coalesce(nullif(left(p_tracking,200),''),tracking_number),carrier=coalesce(nullif(left(p_carrier,200),''),carrier),last_error=null,updated_at=clock_timestamp() where id=s.id;
 select bool_and(state='delivered'),bool_and(state in('shipped','delivered')),bool_or(state in('shipped','delivered')),bool_and(provider_order_id is not null and state not in('exception','submitting','awaiting_creation')),bool_or(state='exception') into all_delivered,all_shipped,any_shipped,all_created,any_exception from public.bidscope_shop_supplier_orders where order_id=o.id;
 update public.bidscope_shop_orders set shipments=(select coalesce(jsonb_agg(jsonb_build_object('id',id,'lineIndex',line_index,'quantity',payload->'quantity','carrier',carrier,'trackingNumber',tracking_number,'status',state,'simulated',true) order by line_index),'[]'::jsonb) from public.bidscope_shop_supplier_orders where order_id=o.id),
 status=case when status in('cancellation_requested','return_requested','refund_pending','refunded','cancelled') then status when any_exception then 'exception' when all_delivered then 'delivered' when all_shipped then 'shipped' when any_shipped then 'partially_shipped' else 'supplier_payment_pending' end where id=o.id;
 if all_created then update public.bidscope_shop_jobs set status='done',lease_until=null,last_error=null where order_id=o.id and kind='fulfilment';end if;
 insert into public.bidscope_shop_audit(order_id,action,details) values(o.id,'sandbox_supplier_synced',jsonb_build_object('supplier_id',s.id,'status',p_status));
 return (select status from public.bidscope_shop_orders where id=o.id);
end $$;

create function public.bidscope_shop_reserve_refund(p_order uuid,p_key uuid,p_amount bigint,p_reason text) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $$
declare o public.bidscope_shop_orders; r public.bidscope_shop_refunds; reserved bigint; result uuid;
begin
 if p_key is null or p_amount is null or p_amount<1 or p_reason is null or length(btrim(p_reason)) not between 1 and 1000 then raise exception 'Invalid refund request';end if;
 select * into o from public.bidscope_shop_orders where id=p_order for update;
 if not found or o.payment_mode<>'test' or o.provider_transaction is null or o.verified_at is null or o.received_amount_minor is distinct from o.total_minor or o.received_mode is distinct from 'test' or o.received_currency is distinct from 'GHS' then raise exception 'Verified sandbox payment required';end if;
 select * into r from public.bidscope_shop_refunds where order_id=o.id and request_key=p_key;
 if found then if r.amount_minor<>p_amount or r.reason<>btrim(p_reason) then raise exception 'Refund key conflict';end if;return r.id;end if;
 if exists(select 1 from public.bidscope_shop_refunds where order_id=o.id and status<>'processed') then raise exception 'Resolve the existing refund before requesting another';end if;
 select coalesce(sum(amount_minor),0) into reserved from public.bidscope_shop_refunds where order_id=o.id;
 if reserved+p_amount>o.total_minor then raise exception 'Refund exceeds payment';end if;
 result:=gen_random_uuid();
 insert into public.bidscope_shop_refunds(id,order_id,request_key,reference,amount_minor,reason,previous_order_status) values(result,o.id,p_key,'BSC-RF-SBX-'||replace(result::text,'-',''),p_amount,btrim(p_reason),o.status);
 update public.bidscope_shop_orders set status='refund_pending' where id=o.id;
 insert into public.bidscope_shop_audit(order_id,action,details) values(o.id,'sandbox_refund_reserved',jsonb_build_object('refund_id',result,'amount_minor',p_amount));
 return result;
end $$;
create function public.bidscope_shop_claim_refund(p_refund uuid) returns boolean
language plpgsql security definer set search_path=pg_catalog,public as $$
declare claimed boolean;
begin
 update public.bidscope_shop_refunds set status='submitting',updated_at=clock_timestamp() where id=p_refund and status='reserved' and mode='test' returning true into claimed;
 return coalesce(claimed,false);
end $$;
create function public.bidscope_shop_sync_refund(p_refund uuid,p_provider text,p_status text) returns text
language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.bidscope_shop_refunds; o public.bidscope_shop_orders; refunded bigint;
begin
 select * into r from public.bidscope_shop_refunds where id=p_refund;
 if not found then raise exception 'Refund not found';end if;
 select * into o from public.bidscope_shop_orders where id=r.order_id for update;
 select * into r from public.bidscope_shop_refunds where id=p_refund for update;
 if r.mode<>'test' or o.payment_mode<>'test' or p_provider is null or p_provider !~ '^[0-9]{1,30}$' or p_status is null or p_status not in('pending','processing','processed','failed','needs_attention') or (r.provider_refund_id is not null and r.provider_refund_id<>p_provider) then raise exception 'Refund mapping mismatch';end if;
 if r.status='processed' then return 'processed';end if;
 update public.bidscope_shop_refunds set provider_refund_id=p_provider,status=p_status,last_error=null,updated_at=clock_timestamp() where id=r.id;
 select coalesce(sum(amount_minor),0) into refunded from public.bidscope_shop_refunds where order_id=o.id and status='processed';
 update public.bidscope_shop_orders set status=case when refunded>=total_minor then 'refunded' when p_status in('processed','failed') and status='refund_pending' then r.previous_order_status else status end where id=o.id;
 insert into public.bidscope_shop_audit(order_id,action,details) values(o.id,'sandbox_refund_synced',jsonb_build_object('refund_id',r.id,'status',p_status));
 return p_status;
end $$;
do $$ declare f regprocedure; begin
 foreach f in array array['public.bidscope_shop_prepare_supplier(uuid)'::regprocedure,'public.bidscope_shop_claim_supplier(uuid)'::regprocedure,'public.bidscope_shop_sync_supplier(uuid,text,text,text,text)'::regprocedure,'public.bidscope_shop_reserve_refund(uuid,uuid,bigint,text)'::regprocedure,'public.bidscope_shop_claim_refund(uuid)'::regprocedure,'public.bidscope_shop_sync_refund(uuid,text,text)'::regprocedure] loop
 execute format('revoke all on function %s from public,anon,authenticated',f);
 execute format('grant execute on function %s to service_role',f);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
