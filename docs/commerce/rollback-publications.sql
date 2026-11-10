-- First set BIDSCOPE_SHOP_PUBLIC_CATALOGUE=0 and deploy the previous runtime.
-- Preserve approvals and audit history; no tables or historical records are deleted.
begin;
revoke execute on function public.bidscope_shop_publish(uuid,text,jsonb),public.bidscope_shop_retire_publication(uuid,text,text) from service_role;
commit;
