-- The matcher reads JSON inputs deterministically but uses Postgres routines classified as stable.
alter function public.customer_match(jsonb,jsonb) stable;
