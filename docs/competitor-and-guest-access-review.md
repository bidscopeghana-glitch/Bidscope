# BidScope: guest access and competitive direction

Research date: 17 September 2026. Prices below are advertised prices retrieved from official websites or indexed official pages, not checkout quotes. Taxes, discounts and exchange rates have not been normalised. Marketing claims are not independent proof of capability.

## Recommendation

Sell time saved, better qualification and organised bidding—not ownership of public tender notices. Give visitors a useful discovery preview, require an account for actionable records, and reserve recurring monitoring, analysis and team workflows for paid plans. Never imply that subscribing guarantees a contract, grants eligibility, or makes BidScope the contracting authority.

The immediate implementation changes guest access, not prices or existing paid entitlements. A free account and a paid subscription are different boundaries. Do not describe a free signup as unlocking premium tools.

## Competitor comparison

| Provider | Advertised pricing / period | Packaging pattern | What BidScope should learn |
| --- | --- | --- | --- |
| TENDERS.com.gh | GHS999 Standard, GHS1,599 Professional, GHS2,099 Enterprise, annually | Alert categories and email/mobile recipients differentiate tiers; bookmarks and reminders | Explain alert limits and recipient limits plainly; offer straightforward Ghana coverage |
| GhanaTenders.com | US$249 Basic, $349 Premium, $449 Platinum, each 12 months | 1 / 3 / 5 accounts; lists search, downloads, email alerts, archives and awards | Make seat counts visible; separate access from services requiring people |
| TenderAlerts, South Africa | R1,799/year; R599/three months; R249/one-month once-off; R199/month debit | Same main access, different commitment periods; five alert categories, ten saved searches, two email recipients | Price period and renewal mechanism should be unmistakable |
| TenderNotice Africa | $19 / $49 / $149 monthly | Country coverage, alerts, seats, exports and API; advertises ten daily tender views for free accounts | Use a deliberate free-to-paid journey rather than blocking everything immediately |
| Tender Africa | Advertises free account, discovery and dossiers; AI analysis charged through credits | Document extraction, eligibility, technical, financial, risk and deadline interpretation | The competitive advantage is grounded analysis of actual documents, not just an AI chat box |

Sources: [TENDERS pricing](https://tenders.com.gh/user/subscription/prices), [GhanaTenders plans](https://www.ghanatenders.com/plans.php), [TenderAlerts](https://tenderalerts.co.za/), [TenderNotice Africa](https://www.tendernoticeafrica.com/), [Tender Africa offer](https://tender.africa/tarifs), [Tender Africa product](https://tender.africa/en/platform/).

Verification caveats: TENDERS pricing was available through indexed official pages; direct requests returned 502 and the browser-control connection timed out. Its signed-in detail page was therefore NOT inspected. Its pricing page lists one Professional email recipient, while its services page lists two: confirm at checkout before treating either as definitive. GhanaTenders feature inclusion icons were not visually validated; listed capabilities should not be assumed included in every tier. Coverage and user-count claims from competitors were not independently tested.

## How TENDERS structures services

Its official services page combines subscriptions with company-profile writing, staff CV preparation, tender preparation, technical/financial proposals, RFP review, training and a supplier introduction service. It advertises a 5% commission for contracts won through direct introductions. These are additional commercial service models, not evidence that all consultancy is included in the subscription. [Official services](https://www.tenders.com.gh/pages/services)

For a solo operator outside Ghana, adapt the self-service parts first: profile templates, tender-specific CV prompts, document checklists, calendars and source-backed RFP summaries. Do not promise on-site representation, unlimited proposal writing, dedicated account managers or round-the-clock human support without the capacity to deliver. Any future adviser marketplace needs vetted partners, customer consent and a separate commercial agreement.

## Your current price position

The repository advertises Pro GHS500/month or GHS5,000/year, Premium GHS1,000/month or GHS10,000/year, and Platinum GHS1,500/month or GHS15,000/year. These are code-level published offers; this review has not independently revalidated production Paystack charges.

Your annual Pro price is about five times TENDERS Standard and 2.38 times its Enterprise. This is a Ghana-cedi comparison with no exchange-rate assumptions. It does not mean BidScope must cut prices, but it means basic tender access and email alerts alone are not a convincing justification.

Keep existing prices unchanged while validating demand. Interview 10–15 actual Ghanaian bidders in construction, supplies and professional services. Show them a complete real tender brief and ask what they currently spend on discovery and qualification. Compare willingness to pay for alerts alone versus the full workflow. Consider an affordable alerts-only entry offer only after testing demand; do not silently downgrade existing customers or change their renewals.

## Recommended access structure

| Stage | Show / enable | Withhold or meter |
| --- | --- | --- |
| Visitor | Sanitised title, category, location, closing date, open status; search and pagination | Buyer, source, full narrative, references, documents, contacts and application link |
| Free account | Available official tender details and source route; meaningful evaluation of the product | Paid monitoring, AI allowances, export and collaboration according to existing entitlements |
| Pro — discover and monitor | Reliable discovery, useful matches, daily alerts, saves, watches, basic AI allowance | Deeper analytical and team capacity |
| Premium — qualify and decide | Evidence-backed eligibility and bid/no-bid, buyer/award context, readiness, reports, more monitoring | Highest collaboration and workload capacity |
| Platinum — prepare and collaborate | Team seats, bid workspace, document/deadline workflow, higher AI and watch allowances | Avoid promising unlimited computation or bespoke human work |

This table recommends positioning; it is not a new entitlement configuration. Existing code advertises AI allowances of 30 / 300 / 1,200 monthly and watch limits of 10 / 50 / 200. Those limits should appear consistently in checkout, account usage and backend enforcement.

## Structure the tender page around a decision

1. Decision summary: what is being bought, location, scope, lots and dates.
2. Eligibility: each condition, supporting source passage, and whether it is met, unmet or unknown for the business. Nationality alone is not proof of eligibility.
3. Mandatory requirements: registrations, certificates, experience, turnover, security and fees, only where published.
4. Submission: actual portal, registration steps, method, documents, deadlines and clarification contact.
5. Evidence: document list, checked date, amendments and per-section citations.
6. Next actions: save, follow changes, ask a grounded question, create a preparation checklist, open the official application route.

Always distinguish “not published”, “document requires registration”, “document retrieval failed” and “not yet extracted”. Do not fill gaps with invented requirements or generic national requirements presented as tender-specific facts.

## Build order for a solo founder

**First: reliable information and conversion.** Finish guest access across APIs and database permissions; validate full customer access; publish accurate sources, freshness and extraction status. Track preview-to-signup and signup-to-first-use rates without exposing personal tender activity publicly.

**Second: retention.** Make saved searches, amendment alerts and closing-date reminders reliable and deduplicated. Measure delivery failures, relevance and successful returns to the workspace. A useful morning digest beats a large number of irrelevant notices.

**Third: paid decision support.** Give users a concise cited brief and checklist with explicit missing information. Show usage remaining before expensive analysis; do not charge for failed analyses. Measure usable-answer rate, latency and cost per completed analysis.

**Fourth: collaboration and expansion.** Add only source coverage whose freshness and document quality can be maintained. Track eligibility evidence for international notices; introduce partnerships later. Validate team seats and roles before selling larger organisations.

Suggested launch gates: guest raw responses contain no protected fields; invalid tokens never unlock detail; direct anonymous database access is denied; signup returns to the chosen tender; signed-in details still work; plan limits cannot be bypassed through APIs; mobile search and signup are usable; amended/expired records are correctly labelled. Test these against a deployed preview and production after release.

## Implementation and rollout notes

Implemented locally: preview-only guest serializers and pages; source-free previews with signup calls to action; validated authenticated responses on shared APIs; no-store responses separated by Authorization; password/Google return-to-tender routing; a database migration revoking anonymous table AND column SELECT grants on tender, document, source-link and award records. Full buyer-detail API now requires authentication because it embeds tender links.

The database migration must be applied alongside release. Merely hiding buttons is insufficient while anonymous PostgREST access remains possible. This report does not certify a production rollout or the signed-in competitor experience. Existing live data and prices have not been modified as part of this local implementation.

Validation: 93 backend tests passed; lint passed; production compilation and type checking passed. A local production server reading the configured database returned HTTP 200 for guest list and detail, with only the preview whitelist present. An invalid bearer token returned HTTP 401 with no tender fields. Signup mode rendered correctly. A full authenticated browser journey, responsive visual inspection and production database migration are still outstanding; browser automation was unavailable. The initial sandbox-only database request failed with EACCES; the network-enabled read-only smoke test subsequently passed.

The service catalogue now includes separately requested tender review, company-profile preparation, tender-specific CVs, proposal support, procurement research and remote training. Requests are authenticated, capped, owner-scoped and quote-based; an administrator must issue scope, fee, turnaround, expiry and terms before the customer can accept. The public catalogue explicitly says that no payment is taken merely by requesting a quote. Launch plan codes are separate from legacy plan codes and remain inactive until matching Paystack recurring products are created and configured.
