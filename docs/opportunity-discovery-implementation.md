# Opportunity discovery implementation note

## Reused BidScope systems

- `procurement_sources` is the canonical registry. The discovery migration extends it with opt-in crawl settings; it does not create a competing source registry.
- `procurement_opportunities` remains the sole published tender feed. The existing `opportunity_sources` join table holds additional provenance for merged discoveries.
- `ingestNormalizedRecords` is reused only after explicit review/publication. Its existing event key `opportunity-created:<id>` avoids duplicate new-tender events. Existing matching and notification jobs consume those published events.
- Existing canonical tender records retain title, buyer, reference, dates, region, category, description, official/document URLs, status, `source_type`, confidence, and verification status. Discovery explicitly uses `NEEDS_REVIEW` verification and never claims BidScope verification from a crawler result alone.
- Existing source sync jobs in `vercel.json`, source health, and admin source integrations are independent of discovery and are not replaced.

## New private staging

`opportunity_discoveries` remembers each checked URL and content hash even when no tender is published. `discovery_crawl_jobs` tracks asynchronous Cloudflare jobs. `discovery_settings` defaults to `enabled=false`, `auto_publish=false`, four crawls per UTC day, one concurrent crawl and zero rendered pages. New sources remain disabled until robots and terms are reviewed. An atomic database claim ensures schedule idempotency and enforces the daily job cap.

The Cloudflare Worker is a scheduler only; Cloudflare's `/crawl` is a REST-only Browser Run endpoint, so a Browser Run binding is not used for that API. The Worker calls a secret-protected Vercel route, which initiates/polls Cloudflare crawl jobs and stores processed results in Supabase. The Cloudflare Browser Run token remains in Vercel's server environment; the Worker holds only a dedicated shared scheduler secret. No public route can launch a crawl.

## Operational gates

1. Apply migration `20260923120000_opportunity_discovery.sql` to the linked production Supabase project after review.
2. Set `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_BROWSER_TOKEN`, and `DISCOVERY_WORKER_SECRET` in Vercel server environment. Put the same `DISCOVERY_WORKER_SECRET` in the Worker as a secret. Never expose either value to the frontend or Git.
3. Deploy the Worker and BidScope release; verify the Worker `/health` endpoint and a scheduler tick. Enable discovery only after an official source's robots policy and terms have been checked. Keep automatic publication off through limited initial testing.
4. Manually inspect extracted fields and duplicates in `/admin/command-centre/opportunity-discovery` before approving anything. Never treat a page title or generic listing as a complete tender notice.

Cloudflare Workers Free account limits should be verified in the dashboard before raising any caps. A paid upgrade is not part of this change.
