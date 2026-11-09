-- CJ creation may return an SD/DP code while query returns a numeric internal ID.
-- Preserve both. Only the private server can record a verified alias mapping.
begin;
alter table public.bidscope_shop_supplier_orders add column provider_order_alias text;
create function public.bidscope_shop_canonicalize_supplier(p_supplier uuid,p_alias text,p_canonical text) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare s public.bidscope_shop_supplier_orders; o public.bidscope_shop_orders;
begin
 if p_alias is null or p_alias !~ '^(SD|DP)[0-9]{8,100}$' or p_canonical is null or p_canonical !~ '^[0-9]{8,100}$' then raise exception 'Invalid CJ alias mapping';end if;
 select * into s from public.bidscope_shop_supplier_orders where id=p_supplier;
 if not found then raise exception 'Supplier order not found';end if;
 select * into o from public.bidscope_shop_orders where id=s.order_id for update;
 select * into s from public.bidscope_shop_supplier_orders where id=p_supplier for update;
 if not s.is_sandbox or o.payment_mode<>'test' then raise exception 'Sandbox mapping required';end if;
 if s.provider_order_id=p_canonical and s.provider_order_alias=p_alias then return;end if;
 if s.provider_order_id is distinct from p_alias or s.state not in('submitting','exception') then raise exception 'Supplier alias conflict';end if;
 update public.bidscope_shop_supplier_orders set provider_order_alias=p_alias,provider_order_id=p_canonical where id=s.id;
 insert into public.bidscope_shop_audit(order_id,action,details) values(o.id,'sandbox_supplier_alias_verified',jsonb_build_object('supplier_id',s.id,'alias',p_alias,'canonical',p_canonical));
end $$;
revoke all on function public.bidscope_shop_canonicalize_supplier(uuid,text,text) from public,anon,authenticated;
grant execute on function public.bidscope_shop_canonicalize_supplier(uuid,text,text) to service_role;
notify pgrst,'reload schema';
commit;
