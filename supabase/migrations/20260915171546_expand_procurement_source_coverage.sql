-- Expand official-source coverage and preserve the tender fields suppliers
-- need to decide whether to pursue an opportunity. All ingestion remains
-- server-side; public tables retain their existing RLS policies.
alter table public.procurement_opportunities
  add column if not exists contact_address text,
  add column if not exists opening_at timestamptz,
  add column if not exists clarification_deadline_at timestamptz,
  add column if not exists bid_validity_days integer check (bid_validity_days is null or bid_validity_days > 0),
  add column if not exists participation_fee_amount numeric(18,2) check (participation_fee_amount is null or participation_fee_amount >= 0),
  add column if not exists participation_fee_currency text check (participation_fee_currency is null or char_length(participation_fee_currency) = 3),
  add column if not exists bid_security_requirement text,
  add column if not exists procurement_codes text[] not null default '{}',
  add column if not exists lots jsonb not null default '[]'::jsonb,
  add column if not exists submission_instructions text,
  add column if not exists qualification_requirements text,
  add column if not exists source_details jsonb not null default '{}'::jsonb;

insert into public.procurement_sources (
  name,slug,organisation,base_url,country_code,integration_type,implementation_status,
  api_enabled,api_key_required,environment_key_name,endpoint_url,sync_enabled,
  sync_frequency,status,trust_level,rate_limit_per_minute,source_scope,
  access_classification,reuse_basis,robots_status,terms_url,coverage_notes,configuration
)
values
('Bank of Ghana','bank-of-ghana','Bank of Ghana','https://www.bog.gov.gh/notice/invitation-for-tenders/','GH','OPEN_API','LIVE',true,false,null,'https://www.bog.gov.gh/wp-json/wp/v2/notice',true,'6 hours','ACTIVE','VERIFIED_OFFICIAL',12,'GHANA','PERMITTED_API','Official WordPress REST index with official notice pages and tender PDFs.','NOT_PUBLISHED',null,'Tender PDFs are text-extracted server-side and every record links back to the Bank of Ghana notice.','{"pdf_enrichment":true,"maximum_records":20}'::jsonb),
('MRH e-Bids','mrh-ebids','Ministry of Roads and Highways','https://bids.mrh.gov.gh/','GH','STRUCTURED_WEB','LIVE',true,false,null,'https://bids.mrh.gov.gh/',true,'6 hours','ACTIVE','VERIFIED_OFFICIAL',6,'GHANA','PERMITTED_WEB_INGESTION','Official public catalogue and detail pages; metadata and official links only.','NOT_PUBLISHED',null,'The source is actively monitored. A successful empty response means the portal currently publishes no active bids.','{"metadata_only":true}'::jsonb),
('UNGM','ungm','United Nations Global Marketplace','https://www.ungm.org/Public/Notice','ZZ','STRUCTURED_WEB','LIVE',true,false,null,'https://www.ungm.org/Public/Notice/Search',true,'6 hours','ACTIVE','VERIFIED_OFFICIAL',6,'INTERNATIONAL','PERMITTED_WEB_INGESTION','Official public procurement-opportunity search and detail pages; robots.txt does not disallow these public routes.','ALLOWED','https://www.ungm.org/robots.txt','Imports active notices with Ghana as beneficiary country, including public documents, UNSPSC codes and registration level.','{"country_id":2370,"page_size":15,"maximum_pages":3}'::jsonb),
('Ghana Highway Authority','ghana-highway-authority','Ghana Highway Authority','https://highways.gov.gh/tenders','GH','STRUCTURED_WEB','LIVE',true,false,null,'https://highways.gov.gh/tenders',true,'12 hours','ACTIVE','VERIFIED_OFFICIAL',4,'GHANA','PERMITTED_WEB_INGESTION','Official public tender page; metadata and official document links only.','NOT_PUBLISHED',null,'Direct authority notices enrich national road-sector coverage.','{"metadata_only":true}'::jsonb),
('Ministry of Finance Adverts','ghana-ministry-finance','Ministry of Finance','https://www.mofep.gov.gh/adverts','GH','STRUCTURED_WEB','LIVE',true,false,null,'https://www.mofep.gov.gh/adverts',true,'12 hours','ACTIVE','VERIFIED_OFFICIAL',6,'GHANA','PERMITTED_WEB_INGESTION','Official adverts index and public detail pages; robots.txt permits these routes.','ALLOWED','https://www.mofep.gov.gh/robots.txt','Imports procurement adverts and excludes cancellations and non-procurement consultations.','{"maximum_pages":2,"maximum_records":20}'::jsonb),
('World Bank','world-bank','World Bank Group','https://projects.worldbank.org/en/projects-operations/procurement','ZZ','OPEN_API','LIVE',true,false,null,'https://search.worldbank.org/api/v2/procnotices',true,'4 hours','ACTIVE','VERIFIED_OFFICIAL',110,'INTERNATIONAL','PERMITTED_API','Official Procurement Notices API and Data Catalog.','API','https://datacatalog.worldbank.org/search/dataset/0037795/world-bank-procurement-notices','Imports current African opportunities and Ghana-funded project and award metadata.','{"page_size":100,"maximum_pages":5}'::jsonb),
('SAM.gov','sam-gov','U.S. General Services Administration','https://sam.gov/content/opportunities','US','API','API_KEY_REQUIRED',false,true,'SAM_GOV_API_KEY','https://api.sam.gov/opportunities/v2/search',false,'6 hours','PAUSED','VERIFIED_OFFICIAL',10,'INTERNATIONAL','API_KEY_REQUIRED','The official Get Opportunities Public API requires a SAM.gov public API key.','API','https://open.gsa.gov/api/get-opportunities-public-api/','Connector is production-ready but cannot be represented as live until a server-side SAM_GOV_API_KEY is configured.','{"maximum_pages":3,"page_size":100}'::jsonb)
on conflict(slug) do update set
  name=excluded.name, organisation=excluded.organisation, base_url=excluded.base_url,
  country_code=excluded.country_code, integration_type=excluded.integration_type,
  implementation_status=excluded.implementation_status, api_enabled=excluded.api_enabled,
  api_key_required=excluded.api_key_required, environment_key_name=excluded.environment_key_name,
  endpoint_url=excluded.endpoint_url, sync_enabled=excluded.sync_enabled,
  sync_frequency=excluded.sync_frequency, status=excluded.status,
  trust_level=excluded.trust_level, rate_limit_per_minute=excluded.rate_limit_per_minute,
  source_scope=excluded.source_scope, access_classification=excluded.access_classification,
  reuse_basis=excluded.reuse_basis, robots_status=excluded.robots_status,
  terms_url=excluded.terms_url, coverage_notes=excluded.coverage_notes,
  configuration=excluded.configuration, last_error=null, consecutive_failures=0,
  updated_at=now();

update public.procurement_source_alerts
set resolved_at=now()
where resolved_at is null
  and source_id in (select id from public.procurement_sources where slug in ('bank-of-ghana','mrh-ebids','ungm','world-bank'));
