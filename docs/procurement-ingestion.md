# Procurement ingestion architecture

The pipeline is `official source → adapter → raw record → canonical normalisation → quality/status/eligibility rules → duplicate resolution → published opportunity`. Each adapter owns source pagination and official URLs. The shared layer sanitises imported HTML, parses dates, computes hashes, assigns status, records eligibility uncertainty and retains raw evidence.

Every accepted record is written to `procurement_raw_records` before canonical upsert. `opportunity_sources` preserves many-to-one provenance. A stable source/external ID wins first, followed by official reference, document fingerprint, then buyer/title/deadline/value composite matching. Changed source hashes create `opportunity_revisions` and amendment events.

Status is recomputed by the database: forecasts/plans are `UPCOMING`; future deadlines are `OPEN` or `CLOSING_SOON` inside seven days; past deadlines are `CLOSED`; missing deadlines are `UNKNOWN`. Public live queries return only `OPEN` and `CLOSING_SOON`. `UNKNOWN` records remain researchable but do not contaminate the live feed.

Scheduled runs are isolated per source. One failure does not stop other adapters. Failures update source health and create a critical `procurement_source_alerts` row. Admins can inspect sync history, raw evidence, and unresolved alerts. The Vercel cron invokes the protected aggregate endpoint; secrets are server-only.
