-- First disable BIDSCOPE_CJ_HOSTED_REVIEW and wait 90 seconds for reads to finish.
begin;
drop function if exists public.bidscope_cj_review_release(uuid);
drop function if exists public.bidscope_cj_review_acquire(uuid);
drop table if exists public.bidscope_cj_review_gate;
commit;
