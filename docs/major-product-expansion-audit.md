# BidScope major product expansion — architecture audit

## Reuse map

- **Identity and access:** `lib/server/auth.ts` already provides bearer-token validation, organization membership checks and the builder super-admin gate (`basintaleuk@gmail.com`). New submission and moderation endpoints reuse these guards.
- **Procurement data:** the canonical `opportunities` and multi-source `procurement_opportunities` tables already carry buyer, source, status, dates, categories, documents and full-text indexes. Approved user submissions should be normalized into these tables only after review; drafts must remain private.
- **Documents:** `opportunity_documents` and the existing document helpers provide the storage/indexing pattern. User uploads should use a private bucket, checksum and malware/size validation before a document is attached to a published opportunity.
- **Customer UI:** `CustomerShell`, `components/customer/pages.tsx`, the existing opportunity detail and profile surfaces are the right integration points. A new `/post-tender` entry can use the same shell and design tokens.
- **Admin UI:** `AdminShell` and the existing API error/session patterns can host a review queue without introducing a second admin framework.
- **Search, alerts and AI:** publication can enqueue the existing ingestion/search/notification paths. Buyer intelligence, awards and AI should consume the normalized opportunity id rather than a parallel data model.

## New data boundary

Phase A adds `tender_submissions`, `tender_submission_documents` and `tender_moderation_events`. A submission is a user-owned intake record, not a public procurement record. Its state machine is:

`DRAFT → SUBMITTED → UNDER_REVIEW → NEEDS_CHANGES | APPROVED → PUBLISHED`, with `REJECTED`, `WITHDRAWN`, `EXPIRED` and `ARCHIVED` terminal/administrative states.

Only the super-admin can move a record into `APPROVED` or `PUBLISHED`. Every transition is append-only in the moderation event log. RLS limits submitters to their own records; public discovery never reads this table directly.

## Duplicate and quality controls

On submit, the API checks reference number, source URL and a normalized title/buyer pair against existing canonical opportunities and other submissions. A match is a warning for the reviewer, not an automatic rejection. The review checklist covers buyer identity, official source, closing date, eligibility, required documents, contact details, budget/currency and publication rights.

## Phased delivery

1. **Phase A (implemented now):** structured submission intake, private ownership, moderation queue/actions, audit events, duplicate warnings and a customer/admin surface.
2. **Phase B:** private document upload with checksum/virus scan, extraction and reviewer-assisted conversion into canonical opportunities; publish-triggered search/alerts.
3. **Phase C:** buyer/award/incumbent relationships, supplier profiles and deduplicated partner marketplace.
4. **Phase D:** major awards showcase, contract-expiry radar, live activity counters and analytics, all derived from canonical published data.

This sequencing keeps unverified user content out of paid discovery, avoids duplicating the existing procurement schema, and leaves a clear path for future imports from every source.
