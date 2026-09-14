-- These four official FTS notices share the same procurement reference, title,
-- deadline and document fingerprint. Keep the latest official publication as
-- the canonical opportunity and preserve every notice URL as source provenance.
update public.opportunity_sources
set opportunity_id='0b09c46e-ab0c-4528-af4a-f479bb3e30b2'
where opportunity_id in (
  '34d84521-e729-4234-a17c-034938f34382',
  '850d3bc3-a75c-4a4f-9667-0eab6c80b0bc',
  '0a85a27b-a173-4e55-be6c-a4767d898ff2'
);

update public.procurement_opportunities
set status='ARCHIVED', source_removed_at=now(), updated_at=now()
where id in (
  '34d84521-e729-4234-a17c-034938f34382',
  '850d3bc3-a75c-4a4f-9667-0eab6c80b0bc',
  '0a85a27b-a173-4e55-be6c-a4767d898ff2'
);

-- Recompute retained intelligence instead of carrying duplicate match rows.
delete from public.organization_opportunity_matches
where opportunity_id in (
  '34d84521-e729-4234-a17c-034938f34382',
  '850d3bc3-a75c-4a4f-9667-0eab6c80b0bc',
  '0a85a27b-a173-4e55-be6c-a4767d898ff2'
);
