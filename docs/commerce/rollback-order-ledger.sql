-- Rollback without deleting order/payment/audit history:
-- 1. Disable BIDSCOPE_SHOP_LEDGER_READY and the new commerce webhook/checkout routes.
-- 2. Preserve all bidscope_shop_* tables for reconciliation and customer records.
-- 3. Restore the preceding application commit e164f96.
-- Never drop a ledger that contains real orders or payments.
begin;
revoke execute on function public.bidscope_shop_create_order(uuid,uuid,uuid) from service_role;
revoke execute on function public.bidscope_shop_record_payment(text,text,bigint,text,text) from service_role;
revoke execute on function public.bidscope_shop_request(uuid,uuid,uuid,text,text) from service_role;
revoke execute on function public.bidscope_shop_begin_payment(uuid,uuid) from service_role;
commit;
