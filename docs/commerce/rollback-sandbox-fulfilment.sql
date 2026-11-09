-- Stop new sandbox actions, wait for the 210-second CJ lease to drain, and
-- restore runtime 56b5f57. Preserve supplier/refund history; do not drop tables.
begin;
revoke execute on function public.bidscope_shop_canonicalize_supplier(uuid,text,text) from service_role;
revoke execute on function public.bidscope_shop_prepare_supplier(uuid) from service_role;
revoke execute on function public.bidscope_shop_claim_supplier(uuid) from service_role;
revoke execute on function public.bidscope_shop_sync_supplier(uuid,text,text,text,text) from service_role;
revoke execute on function public.bidscope_shop_reserve_refund(uuid,uuid,bigint,text) from service_role;
revoke execute on function public.bidscope_shop_claim_refund(uuid) from service_role;
revoke execute on function public.bidscope_shop_sync_refund(uuid,text,text) from service_role;
commit;
