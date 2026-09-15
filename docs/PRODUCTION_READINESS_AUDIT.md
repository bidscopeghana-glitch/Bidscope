# BidScope Production Readiness Audit

Audit date: 15 September 2026

Production domain: `https://www.bidscopeghana.com`
Application: BidScope Ghana procurement intelligence platform

## A. Executive summary

**Overall status: NOT_READY**

The application code, production database, deployment, procurement discovery, authentication core, customer workspace, server-side entitlements, grounded AI fallback and admin monitoring are operating as one coherent system. The production build is clean, the database schema passes Supabase lint, the dependency audit reports zero vulnerabilities, 45 backend tests pass, 30 production API/customer-journey checks pass, four Super Admin API journeys pass, and authenticated responsive browser checks pass at 375px, 768px and 1440px.

The platform must not yet be declared fully ready for unrestricted paying customers because two live-payment controls remain outside the codebase:

1. **ACTION_REQUIRED — controlled live payment:** Paystack production keys and four live plans are configured, but an actual GHS payment, signed webhook, Premium activation, persistence after a new login, cancellation/expiry and refund have not been exercised with real funds.
2. **ACTION_REQUIRED — pending payment reconciliation:** One uncompleted GHS 100 Mobile Money checkout remains pending and needs reconciliation.

Transactional email is now production-configured: the BidScope sending domain is verified in Resend, Supabase Auth custom SMTP is active, and a live password-recovery message to an existing non-team customer address was accepted by Supabase and reported `Delivered` by Resend on 15 September 2026.

Everything safely fixable from code and the connected production database was repaired and deployed. No fake production data was introduced. Audit users and organisations were deleted after testing.

## Architecture map

| Layer | Production implementation |
| --- | --- |
| Frontend | Next.js 16 App Router, React 19, TypeScript, Tailwind CSS |
| Backend | Next.js route handlers and server-only service modules |
| Database | Supabase Postgres with migrations, constraints, indexes and RLS |
| Authentication | Supabase Auth: password credentials, refresh tokens, Google OAuth and password recovery route |
| Hosting | Vercel production deployment and custom domain |
| Procurement ingestion | Scheduled adapters → raw records → normalization → canonical opportunity → provenance → events |
| Search/matching | Server-side PostgREST filters plus the single `customer_discover`/matching implementation |
| Notifications | Canonical procurement events → in-app notifications/deliveries; Tender Watch reuses saved searches |
| AI | Source-grounded deterministic fallback; optional external model only when configured |
| Billing | Paystack initialization, verification, HMAC webhook and one server-side entitlement layer |
| Background work | Two authenticated Vercel crons: procurement sync at 06:00 UTC and notifications/retention/billing reconciliation at 06:15 UTC |
| Admin | Super Admin protected Command Centre APIs and pages for operations, sources, billing, alerts and AI |
| Health/observability | `/api/health`, source sync runs, source alerts, payment states, notification delivery states, audit log and Vercel runtime logs |

## Production route map

### Public

| Purpose | Route | Status |
| --- | --- | --- |
| Home | `/` | WORKING |
| Public discovery | `/opportunities` | WORKING |
| Opportunity detail | `/opportunities/[slug]` | WORKING |
| Plans/pricing | `/plans`, `/pricing` | WORKING |
| Sign in/sign up | `/sign-in` | WORKING; production email delivery verified |
| OAuth callback | `/auth/callback` | WORKING |
| Password reset | `/auth/reset-password` | WORKING; live recovery email delivered |
| Terms/privacy | `/terms`, `/privacy` | WORKING |
| Robots/sitemap | `/robots.txt`, `/sitemap.xml` | WORKING |
| Legacy member entry points | `/live-opportunities`, `/awarded-opportunities`, `/workspace`, `/profile`, `/notifications`, `/settings/alerts` | LEGACY redirects into the authenticated customer shell |

The homepage contains its About/How-it-works material in the `#why` and `#explore` sections. Legal and plan links are present in the public footer. There is no separate public contact form; authenticated help is available at `/customer/help`.

### Authenticated customer shell

All customer routes are under `/customer/[[...section]]` and are guarded by a persisted Supabase session.

| Area | Route |
| --- | --- |
| Home/dashboard | `/customer` |
| Discover/all/Ghana/international/upcoming/closing | `/customer/discover` with server-side filters |
| Recommended/saved/recent | `/customer/recommended`, `/customer/saved`, `/customer/recent` |
| Following/buyers | `/customer/following`, `/customer/buyers` |
| Opportunity detail | `/customer/opportunity/[slug]` |
| Bid workspace/pipeline/deadlines | `/customer/bids`, `/customer/pipeline`, `/customer/deadlines` |
| Documents/readiness/profile | `/customer/documents`, `/customer/readiness`, `/customer/profile` |
| Intelligence/awards/AI | `/customer/intelligence`, `/customer/awards`, `/customer/ai` |
| Alerts/notifications | `/customer/alerts`, `/customer/notifications` |
| Billing/settings/help | `/customer/billing`, `/customer/settings`, `/customer/help` |

### Admin

| Area | Route | Authorization |
| --- | --- | --- |
| Command Centre | `/admin/command-centre` | Super Admin, server enforced |
| Source operations | `/admin/command-centre/procurement-data/sources` | Super Admin, server enforced |
| Revenue/subscriptions | `/admin/command-centre/subscriptions-revenue` | Super Admin, server enforced |
| Alerts/AI monitoring | `/admin/command-centre/alerts-ai` | Super Admin, server enforced |

## B. Fixes completed

| Issue | Severity | Area | Fix | Verification |
| --- | --- | --- | --- | --- |
| Customer dashboard returned generic failures | Critical | Environment/database | Corrected production Supabase/Vercel configuration and hardened health reporting | Dashboard live; production health reports DB connected |
| Saved opportunity Free-tier check selected a nonexistent `id` | High | Entitlements | Added resource-specific count column support and used `opportunity_id` for saved opportunities | Live create/read/delete save journey passed |
| Buyer catalogue was empty | High | Data | Backfilled 289 canonical buyers, linked opportunities, and added bulk buyer upsert to ingestion | Buyer follow/persist/unfollow live journey passed |
| Expired records remained `CLOSING_SOON` intraday | Critical | Opportunity status | Refreshed stored statuses and added query-time deadline enforcement to opportunity APIs, homepage, alerts and admin KPIs | Zero expired opportunities presented as open |
| Africa scope was lost when text search was applied | High | Search | Combined geography and text predicates using an `and` of both `or` groups | Live Africa + `road` query returns African records |
| UK Find a Tender could open raw OCDS JSON | High | UX/provenance | Adapter now produces readable official notice deep links | Adapter tests and live records verified |
| UK Find a Tender ingestion had partial failure | High | Ingestion | Re-ran the source: 92 fetched, 4 inserted, 87 updated, 1 deduplicated, 0 failed | Latest run `SUCCEEDED` |
| Parallel records created four canonical duplicates | High | Deduplication | Consolidated the four notices into one active canonical record, retained all URLs as provenance, archived three source records, and grouped concurrent ingestion by dedupe identity | One active canonical record; future same-source IDs resolve to it |
| Source could silently lose most records | Critical | Observability | Added greater-than-80% volume-drop detection, source degradation and source alerting while preserving old records | Backend tests/build pass; alert schema active |
| Bank of Ghana endpoint repeatedly timed out | High | Source truthfulness | Disabled automated sync, preserved existing records, classified `UNAVAILABLE`, and created an operations alert | Registry and live E2E confirm it is not presented as live |
| Registry claimed 4/6-hour sync while Vercel ran daily | Medium | Operations | Aligned every enabled live source to `daily` | Production registry verified |
| Interrupted source runs remained `RUNNING` | Medium | Operations | Migration closes runs older than 30 minutes as failed with an audit explanation | No stale `RUNNING` records remain |
| 649 procurement events were waiting | High | Notifications | Increased safe function duration/batch capacity, skipped expired created-event notifications, and processed the backlog idempotently | 649 processed; 22 notifications generated; pending count zero |
| Tender Watch could not be deleted | High | Retention | Added authenticated DELETE route and confirmed-delete UI | Live create/edit/delete journey passed |
| Email/WhatsApp settings implied unavailable delivery | High | Product truthfulness | Exposed provider availability; disabled unsupported preferences and labelled them clearly | API/UI build and lint pass |
| Password recovery was absent/unsafe | High | Authentication | Added request/update APIs, reset page, safe invalid-token handling and sign-in link | Invalid token returns safe 401; no provider details exposed |
| Transactional email was not production-configured | Critical | Authentication/email | Verified the BidScope domain in Resend, configured domain-scoped sending, activated Supabase custom SMTP and revoked superseded credentials | Live password-recovery request returned 200 and Resend reported `Delivered` on 15 September 2026 |
| Admin operations required DB inspection | High | Administration | Added Command Centre overview and dedicated source, billing, alert and AI operations pages/APIs | Four live Super Admin endpoints returned 200 with data |
| Generic unhandled page failures | Medium | Error handling | Added global, route and not-found boundaries | Production build includes error routes |
| Dependency advisories | High | Supply chain | Updated lockfile safely | `npm audit --omit=dev`: zero vulnerabilities |
| Node runtime floated to future majors | Medium | Deployment | Pinned production runtime to Node `24.x` | Local/Vercel build compatible |
| Public footer omitted legal links | Medium | Public UX/compliance | Added Plans, Privacy and Terms links | Build/lint pass |
| Homepage illustrative save action looked real | Medium | Product truthfulness | Replaced it with a live discovery action and labelled the record illustrative | Deployed UI contains no fake persistence action |

## C. Remaining external actions

### ACTION_REQUIRED — controlled Paystack live-money acceptance test

Using an authorised low-value real transaction, verify:

1. Card monthly checkout and Paystack redirect.
2. Signed webhook receipt and server verification.
3. One Premium period only, even after replaying the webhook.
4. Premium API access after refresh and a new login.
5. Cancellation/expiry downgrade without data loss.
6. Mobile Money grants fixed-duration, non-renewing access only.
7. Refund/reversal procedure and customer-facing support process.

The pending GHS 100 Mobile Money transaction created on 14 September 2026 at 16:46 UTC must be checked in Paystack and either verified or allowed to reconcile to a terminal failure. It has not activated a subscription.

### ACTION_REQUIRED — optional integrations

- OpenAI model enhancement: set `OPENAI_API_KEY` and `BIDSCOPE_AI_MODEL` only if model-backed analysis is desired. The grounded deterministic assistant is working without these.
- WhatsApp: configure a provider before exposing WhatsApp delivery.
- Source approvals: UNGM authorization, SAM.gov API key, AfDB integration research, and a stable permitted Bank of Ghana endpoint.
- Add an external error-tracking/log drain before scale; current Vercel logs and database operations monitoring are functional but reactive.

## D. Procurement source health

| Source | Classification | State | Last successful evidence |
| --- | --- | --- | --- |
| GHANEPS | HEALTHY | LIVE / ACTIVE / daily | 50 fetched in latest run; 2 inserted, 48 updated |
| Ministry of Roads and Highways | HEALTHY | LIVE / ACTIVE / daily | 7 fetched, 7 updated |
| World Bank | HEALTHY | LIVE / ACTIVE / daily | 17 fetched, 17 updated |
| African Union | HEALTHY | LIVE / ACTIVE / daily | 5 fetched, 5 updated |
| ECOWAS | HEALTHY | LIVE / ACTIVE / daily | 6 fetched, 6 updated |
| Tenders Electronic Daily | HEALTHY | LIVE / ACTIVE / daily | 100 fetched, 100 updated |
| UK Contracts Finder | HEALTHY | LIVE / ACTIVE / daily | 100 fetched, 100 updated |
| UK Find a Tender | HEALTHY | LIVE / ACTIVE / daily | 92 fetched; latest run succeeded |
| Bank of Ghana | RESEARCH_REQUIRED | UNAVAILABLE / disabled | Endpoint repeatedly timed out; records preserved |
| African Development Bank | RESEARCH_REQUIRED | UNAVAILABLE / disabled | Stable permitted ingestion not yet implemented |
| Ministry eBids | CONFIGURATION_REQUIRED | PAUSED | Manual configuration required |
| SAM.gov | CONFIGURATION_REQUIRED | PAUSED | API key required |
| UNGM | AUTHORIZATION_REQUIRED | PAUSED | Source authorization required |

Production data at the final audit point:

- 401 retained opportunity records, including archived provenance records.
- 249 status-open records after duplicate archival; 49 Ghana and 200 international.
- Zero expired records still presented with an open status.
- 25 awards.
- 289 canonical buyers.
- Zero unprocessed procurement events.
- Zero failed notification deliveries.
- Zero isolated audit users or organisations remaining.

The one raw duplicate fingerprint group is intentionally retained as one active canonical record plus three archived provenance records. It does not produce duplicate search results.

## E. Payment readiness

| Control | Status | Evidence |
| --- | --- | --- |
| Live Paystack secret server-only | WORKING | Present only in Vercel production; no client exposure found |
| Backend-authoritative price | WORKING | Client submits plan code; server reads price/amount from `billing_plans` |
| Currency | WORKING | GHS plans configured |
| Monthly card | CONFIGURED | GHS 100 |
| Annual card | CONFIGURED | GHS 1,100 |
| Mobile Money 30 days | CONFIGURED | GHS 100, non-renewing |
| Mobile Money 365 days | CONFIGURED | GHS 1,000, non-renewing |
| Transaction verification | WORKING IN CODE | Server verifies Paystack result before fulfilment |
| Webhook authenticity | WORKING IN CODE | Raw payload HMAC checked against `x-paystack-signature` |
| Idempotency | WORKING IN CODE | DB function row-locks transaction; repeated success is idempotent |
| Premium authorization | WORKING | Free user received 402 from Premium APIs in production |
| Live end-to-end payment | ACTION_REQUIRED | No authorised real-money audit charge was made |

## F. Security findings

### Critical

No unresolved code-level Critical finding was found.

### High

- **Fixed:** cross-organisation access is enforced server-side; an isolated outsider received 403.
- **Fixed:** normal user received 403 from admin API.
- **Fixed:** Premium state is database/server authoritative; Free API calls received 402.
- **Fixed:** Paystack amount, currency and fulfilment are server controlled and webhook signed.
- **Fixed:** expired tenders cannot appear as live through API time-of-request checks.
- **Fixed:** service keys remain server-only; public pages use publishable access only where applicable.
- **Fixed:** public password-recovery delivery uses the verified BidScope sending domain and Supabase custom SMTP; a live recovery email was delivered successfully.

### Medium

- CSP, frame denial, MIME sniff prevention, referrer policy and restrictive permissions policy are deployed.
- Private/admin routes are excluded from robots indexing.
- External official URLs are validated to HTTP(S) before use.
- Document indexing has server authentication, input validation, bounded processing and safe customer errors; expanding automatic remote-document retrieval should add explicit DNS/IP SSRF resolution controls before launch.
- Current application-level API abuse protection relies primarily on provider/platform controls and database quotas. Add Vercel WAF/rate-limit rules as traffic grows.

### Low

- Add an independent error tracker and alert destination so failures are pushed rather than discovered through the Command Centre.
- Schedule periodic access-control and RLS regression tests as the schema evolves.

Supabase schema lint reported zero errors. Tables containing customer, billing, AI and notification state use RLS, while server routes additionally enforce user, organisation and Super Admin authorization.

## G. Test results

| Test area | Result |
| --- | --- |
| Backend/unit/integration | PASS — 45/45 |
| Lint | PASS — zero errors |
| TypeScript/production build | PASS — 25 pages generated; all API routes compiled |
| Dependency audit | PASS — zero vulnerabilities |
| Supabase schema lint | PASS — zero errors |
| Production E2E/API | PASS — 30/30 live checks |
| Admin E2E/API | PASS — overview, sources, subscriptions and alerts/AI returned 200 for isolated Super Admin |
| Authorization | PASS — cross-organisation 403, normal-user admin 403, Free Premium calls 402 |
| Auth | PASS — password sign-in, refresh and isolated-user cleanup; Google OAuth previously verified |
| Procurement discovery | PASS — real Ghana opportunity, detail, Ghana total and combined Africa+keyword query |
| Persistence | PASS — organisation, save, Tender Watch and buyer follow persisted and were removable |
| AI | PASS — source-grounded fallback returned verified structure without model credentials |
| Ingestion | PASS — real UK Find a Tender sync succeeded; eight live sources have current successful runs |
| Events/notifications | PASS — 649-event backlog processed; zero pending; dedupe constraints active |
| Responsive authenticated browser | PASS — dashboard/discovery at 375, 768 and 1440; no overflow or browser errors |
| Responsive public browser | PASS — sign-in at 375/768 and pricing at 375/1440; no overflow or browser errors |
| Route smoke | PASS — home, login, pricing, discovery, customer, admin, legal, robots and sitemap returned expected responses |
| Paystack logic/security | PASS — unit/integration; live charge remains ACTION_REQUIRED |
| Email delivery | PASS — verified BidScope Resend domain, Supabase custom SMTP active, live password-recovery message reported `Delivered` |

The automated browser was able to validate core public and authenticated pages. A single all-pages browser batch was unreliable in the local Chrome sandbox, so API response coverage and targeted browser runs were used instead of treating the sandbox hang as an application failure.

## H. Performance

Completed improvements:

- Discovery is paginated and filtered server-side; the full database is not loaded into the browser.
- Independent dashboard/admin queries run in parallel.
- Buyer normalization is bulk-upserted rather than queried once per opportunity.
- Heavy customer detail, AI and bid modules are dynamically loaded.
- Long lists have limits and purpose-built database indexes.
- Homepage counts have five-minute edge caching with stale-while-revalidate.
- Duplicate-group sequencing preserves cross-group ingestion concurrency while eliminating same-record races.
- Notifications process a bounded 500-event batch within a 300-second function budget.

Measured route response samples from production were approximately 0.35–1.31 seconds during the audit, with database/API cold starts included. No browser horizontal overflow was detected at tested sizes.

Remaining non-blocking work:

- Add continuous Web Vitals/Speed Insights baselines.
- Load-test search, notification fan-out and ingestion at materially larger customer volumes.
- Replace per-event notification opportunity lookups with a bulk fetch or durable queue before event volume grows substantially.

## I. Feature status

| Feature | Classification | Final state |
| --- | --- | --- |
| Public landing and navigation | EXISTING_AND_WORKING | WORKING |
| Password/Google authentication | EXISTING_AND_WORKING | WORKING; production recovery email verified |
| Session refresh/persistence | EXISTING_AND_WORKING | WORKING |
| Password recovery | MISSING → FIXED | WORKING; live recovery email delivered |
| Customer command centre | EXISTING_BUT_NOT_WIRED → FIXED | WORKING |
| Discovery/search/filtering | PARTIALLY_IMPLEMENTED → FIXED | WORKING |
| Ghana/international/Africa scope | PARTIALLY_IMPLEMENTED → FIXED | WORKING |
| Opportunity details/provenance | EXISTING_AND_WORKING | WORKING |
| Matching/recommendations/Best Match | EXISTING_AND_WORKING | WORKING, one authoritative engine |
| Bid/No-Bid | EXISTING_AND_WORKING | Premium, server enforced |
| Saved opportunities | BROKEN → FIXED | WORKING |
| Tender Watch | PARTIALLY_IMPLEMENTED → FIXED | WORKING |
| Follow buyer | EXISTING_BUT_NOT_WIRED → FIXED | WORKING |
| Buyer catalogue | BROKEN → FIXED | WORKING |
| Radar/upcoming | EXISTING_AND_WORKING | WORKING; official vs insight labels separated |
| Tender revisions/change severity | EXISTING_AND_WORKING | WORKING |
| Readiness score | EXISTING_AND_WORKING | WORKING from persisted evidence |
| Bid workspace | EXISTING_AND_WORKING | Premium, persisted |
| In-app notifications | PARTIALLY_IMPLEMENTED → FIXED | WORKING |
| Email notifications | PARTIALLY_IMPLEMENTED → FIXED | CONFIGURED through verified Resend sender/domain; auth delivery verified and alert provider health check passes |
| WhatsApp | MISSING | DISABLED and labelled unavailable |
| AI assistant | EXISTING_AND_WORKING | Grounded fallback WORKING; model enhancement optional |
| Tender intelligence report | EXISTING_AND_WORKING | Integrated into opportunity intelligence/AI views |
| Free/Premium entitlement | EXISTING_AND_WORKING | Server authoritative |
| Paystack | PARTIALLY_IMPLEMENTED → FIXED | CONFIGURED; live-money journey ACTION_REQUIRED |
| Awards intelligence | EXISTING_AND_WORKING | WORKING with 25 records |
| Admin Command Centre | MISSING → FIXED | WORKING |
| Health endpoint/global errors | MISSING/PARTIAL → FIXED | WORKING |
| Source drop alerting | MISSING → FIXED | WORKING |

## J. Launch blockers

1. **ACTION_REQUIRED: execute and document a controlled real Paystack payment/webhook/Premium/cancellation test.**
2. **ACTION_REQUIRED: reconcile the existing pending GHS 100 Mobile Money checkout.**

Once those actions pass, rerun the live production E2E suite and change the executive status to `READY_WITH_NON_BLOCKING_ACTIONS` or `READY` based on the result.

## Final hard-wiring trace

- **Best Match:** customer UI → `/api/retention` → authenticated organisation → persisted business profile → authoritative matching engine → live non-expired opportunity set → persisted match/best-match fields → dashboard.
- **Follow Buyer:** UI → `/api/watched-entities` → organisation membership → persisted buyer relationship → procurement event → deduplicated notification → dashboard/deep link.
- **Tender Watch:** UI → `/api/customer` saved search → persisted filters → scheduled search matching → notification → opportunity deep link.
- **Payment:** pricing → `/api/billing/checkout` → server-owned plan/amount → Paystack → callback/webhook server verification → idempotent DB fulfilment → subscription → server entitlement → Premium UI/API.
- **Ingestion:** official adapter → raw immutable record → normalization/status/eligibility → dedupe/canonical record → provenance/revision/event → discovery/matching/alerts.

The full software path is wired. Transactional email delivery is verified. The remaining blockers are live-money acceptance and reconciliation controls, not missing application architecture.
