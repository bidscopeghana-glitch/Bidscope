# BidScope Free + Premium audit

Audit date: 2026-09-14

## Existing architecture

BidScope uses Supabase Auth with organisation-owned workspaces. Billing must therefore attach to `organizations`, not individual team members. The existing `subscriptions` and `webhook_events` tables are provider-neutral but only support a narrow legacy status set. `/api/subscription` is read-only and `/api/internal/subscriptions/sync` trusts an internal caller; there is no customer checkout, Paystack signature validation, server verification, billing history, cancellation, reconciliation, central entitlement layer, or usage-period accounting.

The existing `/plans` page contains Free, Pro and Business marketing cards but no prices and no checkout. No authoritative production price or Paystack plan code exists in the repository, migrations, or environment template. Paid activation must remain `PRICING_CONFIGURATION_REQUIRED` until an administrator configures real prices and provider plan codes.

The authenticated Paystack browser session currently shows “Verify your email address”. Consequently live/test keys, plans, customers, webhooks, live-mode status and merchant currency cannot yet be safely inspected or changed. No dashboard mutation was performed.

## Feature classification and reuse decision

| Feature | Audit status | Decision |
| --- | --- | --- |
| Personal Opportunity Feed | PARTIALLY_IMPLEMENTED | Reuse discovery and retention feed; add entitlement-aware feed metadata. |
| Best Match | EXISTING_AND_WORKING | Reuse evidence-based retention matcher; Premium-gate full explanation server-side. |
| Advanced AI Matching | PARTIALLY_IMPLEMENTED | Reuse match engine; expose basic recommendation on Free and full scoring on Premium. |
| Tender Watch | EXISTING_AND_WORKING | Reuse saved searches; centralise Free/Premium limits and frequencies. |
| Smart Alerts | PARTIALLY_IMPLEMENTED | Reuse notifications/email; gate advanced frequencies and limits. |
| Follow Buyers | EXISTING_AND_WORKING | Reuse watched entities; centralise limits and Premium activity automation. |
| Buyer Intelligence | PARTIALLY_IMPLEMENTED | Reuse buyers, awards and opportunity data; gate advanced intelligence, never fabricate. |
| Bid / No-Bid Advisor | EXISTING_AND_WORKING | Reuse retention assessment; Premium-gate the full advisor API. |
| Procurement Radar | EXISTING_AND_WORKING | Reuse official radar; Premium-gate predictive/intelligence surface. |
| Tender Change Monitoring | EXISTING_AND_WORKING | Reuse revisions/events/notifications; Premium-gate automated monitoring. |
| Business Readiness Score | EXISTING_AND_WORKING | Reuse evidence score; Premium-gate dimension detail while retaining a Free teaser. |
| Tender Intelligence Report | PARTIALLY_IMPLEMENTED | Reuse grounded AI/document retrieval; add report action and Premium entitlement. |
| AI Tender Analysis | EXISTING_AND_WORKING | Reuse grounded assistant; move limits to authoritative plan configuration. |
| Bid Workspace | EXISTING_AND_WORKING | Reuse existing pipeline/preparation; Premium-gate editing without deleting data. |
| Eligibility Analysis | EXISTING_AND_WORKING | Reuse structured assessment and official evidence. |
| International Eligibility | PARTIALLY_IMPLEMENTED | Reuse existing classifications; include in Premium advisor/report. |
| Deadline Monitoring | EXISTING_AND_WORKING | Reuse notification processor. |
| Amendments | EXISTING_AND_WORKING | Reuse verified revisions and severity. |
| Saved Searches | EXISTING_AND_WORKING | Reuse and enforce plan limits centrally. |
| Historical Awards | EXISTING_AND_WORKING | Keep basic public-source history on Free; advanced aggregation Premium. |
| Market Intelligence | PARTIALLY_IMPLEMENTED | Reuse indexed pulse/awards; Premium-gate advanced analysis. |
| Payment code | LEGACY | Preserve provider-neutral sync only for backwards compatibility; build Paystack adapter around the authoritative service. |
| Subscription entitlement | MISSING | Build one server-side service and centrally configured plan/feature limits. |
| Billing page/history | MISSING | Build customer billing route and UI. |
| Paystack checkout/verify/webhook | MISSING | Build secure server-side flow with idempotent fulfilment. |
| Admin subscriptions/revenue | MISSING | Extend the existing Command Centre with billing operations and configuration state. |

## Security findings

- Existing customer features trust authenticated API calls correctly, but Premium access is not enforced.
- Existing AI limits are hard-coded by legacy plan names and reset daily rather than by billing period.
- Existing subscription rows cannot be directly updated by authenticated clients; retain this property.
- No Paystack secret is present in committed source. The new integration must remain dormant when `PAYSTACK_SECRET_KEY` is absent.
- The public official-source principle is already present and must remain unchanged: opportunity titles, basic facts and official links stay available to Free users.

## Implementation plan

Extend the current provider-neutral tables, add plan configuration, payment transactions, usage counters and auditable grants, then introduce one `entitlements` service used by every Premium API. Build Paystack initialization, callback verification, signature-verified webhook processing, cancellation and reconciliation on top of that service. Reuse the existing customer shell and Command Centre rather than creating a second application.
