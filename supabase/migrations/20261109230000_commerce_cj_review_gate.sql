-- Private, shared admission gate for administrator-only CJ review reads.
-- No historical tender or catalogue rows are changed.
begin;
create table public.bidscope_cj_review_gate (
 id boolean primary key default true check (id),
 lease uuid,
 available_at timestamptz not null default '-infinity'
);
insert into public.bidscope_cj_review_gate(id) values(true);
alter table public.bidscope_cj_review_gate enable row level security;
revoke all on public.bidscope_cj_review_gate from public,anon,authenticated;

create function public.bidscope_cj_review_acquire(p_lease uuid) returns boolean
language plpgsql security definer set search_path=pg_catalog,public as $$
declare acquired boolean;
begin
 if p_lease is null then return false; end if;
 update public.bidscope_cj_review_gate set lease=p_lease,available_at=clock_timestamp()+interval '90 seconds'
 where id=true and available_at<=clock_timestamp() returning true into acquired;
 return coalesce(acquired,false);
end; $$;
create function public.bidscope_cj_review_release(p_lease uuid) returns void
language sql security definer set search_path=pg_catalog,public as $$
 update public.bidscope_cj_review_gate set lease=null,available_at=clock_timestamp()+interval '2 seconds'
 where id=true and lease=p_lease;
$$;
revoke all on function public.bidscope_cj_review_acquire(uuid) from public,anon,authenticated;
revoke all on function public.bidscope_cj_review_release(uuid) from public,anon,authenticated;
grant execute on function public.bidscope_cj_review_acquire(uuid) to service_role;
grant execute on function public.bidscope_cj_review_release(uuid) to service_role;
commit;
