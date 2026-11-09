-- First stop commerce workers, keep checkout disabled, reconcile open money and
-- supplier orders, and export a full database backup. Do not delete order history.
begin;
revoke all on schema commerce from authenticated,service_role;
alter schema commerce rename to commerce_archived_v1;
commit;
-- Restore (only after review): rename commerce_archived_v1 back to commerce;
-- restore schema grants explicitly. Tables, RLS and order history remain intact.
