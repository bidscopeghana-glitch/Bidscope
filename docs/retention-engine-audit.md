# BidScope retention engine audit

Audit date: 2026-09-14

This audit was completed before implementation. The retention work extends the existing customer command centre, canonical procurement tables, matching function, notification engine and scheduler. It does not introduce a second opportunity, alert or authentication system.

| Capability | Classification | Existing foundation | Implementation decision |
| --- | --- | --- | --- |
| Personal opportunity feed | PARTIALLY_IMPLEMENTED | `customer_discover`, `customer_match`, recent views, saved opportunities | Persist explainable organisation/opportunity assessments; add hide/not-relevant feedback and exclude hidden records from discovery. |
| Smart alerts / Tender Watch | EXISTING_BUT_NOT_FULLY_WIRED | Saved searches, alert preferences, notifications, delivery queue, scheduled processor | Add per-watch frequency and surface recent alert activity. Keep the existing delivery and deduplication path. |
| Follow buyers | EXISTING_BUT_NOT_FULLY_WIRED | `watched_entities` and buyer-activity notifications | Add relevant-only control and surface followed-buyer activity in the customer home. |
| Bid / no-bid advice | PARTIALLY_IMPLEMENTED | Canonical deterministic opportunity matching and grounded AI context | Extend the same matching evidence into component scores and a persistent, auditable decision. Unknown evidence remains unknown; it is never converted to a positive assumption. |
| Procurement radar | PARTIALLY_IMPLEMENTED | Upcoming opportunities, awards, buyers and canonical source metadata | Store evidence-backed radar items. Official upcoming notices are labelled separately from inferred signals. No speculative signal is shown without source evidence. |
| Tender change monitoring | EXISTING_BUT_NOT_FULLY_WIRED | Source hashes, opportunity revisions, procurement events and amendment alerts | Add change types/severity and notify users who save, track, analyse or explicitly watch an opportunity. |
| Business readiness score | PARTIALLY_IMPLEMENTED | Organisation profile, supplier documents and customer profile UI | Add evidence-based category scores, recommendations and snapshots. Missing data reduces confidence and creates a recommendation. |
| Best Match | PARTIALLY_IMPLEMENTED | Recommended collection sorted by canonical match score | Persist one current eligible Best Match per organisation and explain why it was chosen. Closed/restricted opportunities are excluded. |
| Admin retention metrics | PARTIALLY_IMPLEMENTED | Alerts/AI admin endpoint and analytics events | Extend the endpoint with watches, follows, assessments, feedback, decisions, radar and Best Match coverage. |

## Reuse and deprecation decisions

- `procurement_opportunities` remains the only canonical opportunity store used by the customer experience.
- `customer_saved_searches` remains the Tender Watch store. The older `alert_rules` and `alert_deliveries` tables are treated as legacy and are not extended.
- `alert_preferences`, `notifications` and `notification_deliveries` remain the only active notification pipeline.
- `watched_entities` remains the follow system.
- `calculateOpportunityMatch` and the database `customer_match` function remain the base business-match calculation. The retention assessment adds evidence categories around that result rather than replacing it.
- The older `opportunities` table is left intact for migration compatibility but is not used for new retention features.

## Data and safety rules

- All customer-owned records are protected by row-level security and organisation membership checks.
- Service-role access is reserved for scheduled ingestion, recalculation and notification processing.
- Scores carry reasons, concerns, evidence timestamps and confidence. Missing evidence is shown as unknown.
- A hard eligibility restriction, a closed/cancelled notice or a passed deadline can never be selected as Best Match.
- Every recommendation links back to the canonical opportunity and its official source.
