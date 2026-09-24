begin;

-- Rights review 2026-09-25. The World Bank Data Catalog explicitly licenses
-- the Procurement Notices dataset under CC BY 4.0, including commercial reuse.
-- Its Projects & Operations and IPF FY2020+ contract-awards datasets are also
-- independently CC BY 4.0. This does not license attachments or other portals.
update public.procurement_sources set
  reuse_status = 'explicitly_licensed',
  license_name = 'Creative Commons Attribution 4.0 International (Procurement Notices dataset)',
  license_url = 'https://datacatalog.worldbank.org/search/dataset/0037795/world-bank-procurement-notices',
  permission_evidence = 'https://data.worldbank.org/summary-terms-of-use ; https://datacatalog.worldbank.org/search/dataset/0037800/world-bank-projects-operations ; https://datacatalog.worldbank.org/search/dataset/0066219/contract-awards-in-investment-project-financing-since-fy-2020',
  permission_date = date '2026-09-25',
  permission_notes = 'CC BY 4.0 applies to the separately reviewed Procurement Notices, Projects & Operations, and IPF FY2020+ Contract Awards datasets. Attribute The World Bank and each dataset; link to official notice. Do not mirror tender attachments or treat other World Bank datasets as covered.',
  content_reuse_allowed = true,
  commercial_reuse_allowed = true,
  metadata_reuse_allowed = true,
  document_reuse_allowed = false,
  official_source = true,
  discovery_enabled = false,
  discovery_auto_publish_enabled = false,
  last_rights_reviewed_at = now(),
  updated_at = now()
where slug = 'world-bank';

-- Preserve the required dataset attribution on previously indexed notices too.
update public.procurement_opportunities set
  source_details = coalesce(source_details, '{}'::jsonb) || jsonb_build_object(
    'Attribution', 'The World Bank: World Bank Procurement Notices dataset (CC BY 4.0). https://datacatalog.worldbank.org/search/dataset/0037795/world-bank-procurement-notices'
  )
where source_id = (select id from public.procurement_sources where slug = 'world-bank');

-- UNGM's published terms prohibit commercial/public republication without
-- written permission. Disable its legacy connector; do not erase historical rows.
update public.procurement_sources set
  reuse_status = 'prohibited',
  permission_evidence = 'https://help.ungm.org/hc/en-us/articles/360012913619-Intellectual-Property-Rights-and-Copyright',
  permission_date = date '2026-09-25',
  permission_notes = 'UNGM material cannot be reused commercially or published on another website without prior written permission. Re-review only if permission is obtained.',
  content_reuse_allowed = false,
  commercial_reuse_allowed = false,
  metadata_reuse_allowed = false,
  document_reuse_allowed = false,
  discovery_enabled = false,
  discovery_auto_publish_enabled = false,
  sync_enabled = false,
  status = 'PAUSED',
  last_rights_reviewed_at = now(),
  updated_at = now()
where slug = 'ungm';

commit;
