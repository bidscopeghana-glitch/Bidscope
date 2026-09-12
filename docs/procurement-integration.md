# BidScope multi-source procurement intelligence

## Architecture

Every record follows the same server-side flow:

`official/public source -> source adapter -> validation and normalisation -> deduplication -> procurement_opportunities -> BidScope UI`

Source-specific code lives in `lib/server/procurement`. The UI never extracts or interprets a publisher's source format. `opportunity_sources` attaches several official/public appearances to one canonical opportunity while keeping a preferred official route.

## Honest source classifications

| Source | Method | Classification | Notes |
| --- | --- | --- | --- |
| World Bank | Official open API | LIVE | Notices, projects and IPF contract awards; no API key required. Ghana filtering is repeated locally after response validation. |
| GHANEPS | Reviewed manual import | READY — MANUAL CONFIGURATION REQUIRED | Public tender search and exact tender pages exist, but no documented public aggregation API was verified. |
| MRH e-Bids | Reviewed manual import | READY — MANUAL CONFIGURATION REQUIRED | Public portal verified. Automation and reuse require technical/legal review. |
| Bank of Ghana | Reviewed manual import | READY — MANUAL CONFIGURATION REQUIRED | Official HTML notices and documents are public; no public procurement API was verified. |
| UNGM | Manual adapter | NEEDS REVIEW | Notices are publicly accessible. No third-party aggregation API was verified. |
| African Development Bank | RSS adapter slot | NEEDS REVIEW | The official procurement page advertises RSS feeds, but the exact procurement feed and reuse conditions require validation before activation. |

No adapter invents credentials or endpoints. A non-live adapter returns an explicit health message and an empty fetch result. It cannot be scheduled as live.

## Security and administration

- Source credentials are environment-only; the database stores an environment variable name, never the secret value.
- All connectors run on the server.
- External JSON is schema-validated with Zod and imported HTML is stripped before persistence.
- Retries use capped exponential backoff and an in-process per-source rate guard.
- All new public-schema tables use RLS and explicit grants.
- Super Admin status is database-enforced through `profiles.is_super_admin`; authenticated users cannot update that column.
- Source changes and sync actions write audit records without credential values.
- One source failure is caught independently and does not stop other live sources.

## Operations

- Scheduled route: `GET /api/internal/procurement/sync`, authenticated by Vercel `CRON_SECRET` or `BIDSCOPE_INTERNAL_SECRET`.
- Single-source route: `POST /api/internal/procurement/sync/:slug`.
- Validated manual import: `POST /api/internal/procurement/ingest`.
- Super Admin controls: `/admin/command-centre/procurement-data/sources` and `/api/admin/procurement-sources/*`.
- Public source status: `GET /api/procurement-sources`.
- The default Vercel schedule runs every six hours. Only sources marked `LIVE`, `ACTIVE`, and `sync_enabled` run.
- Expired open opportunities are closed before scheduled ingestion.

### World Bank official endpoints

- Procurement notices: `https://search.worldbank.org/api/v2/procnotices`
- Projects and operations: `https://search.worldbank.org/api/v2/projects`
- IPF contract awards since FY2020: `https://datacatalogapi.worldbank.org/dexapps/fone/api/apiservice?datasetId=DS00005&resourceId=RS00005&type=json`

The connector requests Ghana notices, performs a second Ghana/beneficiary check locally, paginates safely, excludes contract-award notices from open opportunities, links projects without duplication, and imports Ghana awards into the awards history. Cached verified database records remain available when an upstream request fails.

## Submission semantics

BidScope resolves the best exact route in this order: `official_submission_url`, `official_tender_url`, then `official_source_url`. The destination opens in a new tab and BidScope remains open. A click records `OFFICIAL_SUBMISSION_OPENED`; it is never counted as `SUBMITTED`. Only the user's explicit return confirmation changes the bid to `SUBMITTED`.

## Migration

`20260912160000_multi_source_procurement_intelligence.sql` runs after the original backend migration. `20260912170000_activate_world_bank_open_data.sql` then adds project relationships, World Bank award linkage and the six-hour live source configuration. Existing opportunity IDs and user history are preserved.

Before production deployment, dry-run and apply the migration through the linked Supabase project, promote a real owner account by setting `profiles.is_super_admin = true` in the SQL editor, configure `CRON_SECRET`, and run the World Bank connector health check from the Command Centre.
