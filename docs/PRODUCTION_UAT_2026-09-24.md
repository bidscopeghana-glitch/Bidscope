# BidScope Production UAT — 24 September 2026

Production: `https://www.bidscopeghana.com`

This matrix tracks outside-in browser acceptance. `PENDING` means no current live evidence has yet been collected. Historical audits and unit tests are supporting evidence only, not substitutes for the live journey.

## Test safety

- No live payment, real external bid, bulk notification, or third-party contact.
- Production mutations must use clearly labelled QA records and be removed or archived afterward.
- External tenders are read-only. Bid/meeting/message tests use BidScope-managed QA tenders only.
- Payment testing is limited to test/sandbox mode unless the account is conclusively confirmed to be in test mode.

## Test matrix

| ID | Persona / area | Live journey | Expected control | Mutation | Status |
| --- | --- | --- | --- | --- | --- |
| PUB-01 | Logged out | Home, navigation, footer, pricing, legal, contact | Pages render; no private data or broken links | None | PASS |
| PUB-02 | Logged out | Tender list, search, filters, pagination and detail | Limited preview; source and protected details hidden | None | PARTIAL — catalogue and detail restrictions pass; search/filter/pagination remain |
| PUB-03 | Logged out | Supplier/buyer signup, invalid inputs, duplicate email, password reset | Clear validation, Turnstile and safe redirects | Test account only | PARTIAL — account type, legal consent, Turnstile and native invalid-input validation pass; account lifecycle remains |
| AUTH-01 | Supplier | Password/Google login, refresh, logout and return path | Persistent session and correct supplier workspace | None | PENDING |
| SUP-01 | Supplier | Onboarding and profile persistence | Business fields persist after refresh/re-login | QA profile | PENDING |
| SUP-02 | Supplier | Dashboard, recommendations, saved, alerts, documents and settings | Every visible action works | QA saves/alerts | PENDING |
| SUP-03 | Supplier | Search Ghana/international/external/managed records | Correct filters, empty states and provenance | None | PENDING |
| SUP-04 | Supplier | Save/watch/unwatch and persistence | No duplicates; correct deep links | QA saves/watch | PARTIAL — save and persistence pass; broken remove toggle fixed locally, deployment retest and cleanup pending |
| VER-01 | Supplier/admin | Basic, verified and enhanced application lifecycle | No false official claim; GHS 500 disclosure | QA application/files | PENDING |
| VER-02 | Supplier/admin | Integrity, duplicate and mismatched QA documents | Hash/risk/private-file controls work | QA files | PENDING |
| BUY-01 | Buyer | Signup, onboarding, dashboard and role isolation | Buyer stays in buyer workspace; safe role switching | QA buyer | PENDING |
| BUY-02 | Buyer | Create draft and publish managed QA tender | Validation, visibility and ownership are correct | QA tender | PENDING |
| BID-01 | Supplier/buyer | Submit, view, withdraw, shortlist/reject/award | Cross-tenant isolation and correct audit state | QA bid | PENDING |
| MSG-01 | Supplier/buyer | Managed-tender chat and voice-call controls | Only participants; external tenders excluded | QA messages | PENDING |
| TEAM-01 | Buyer/supplier | Team and meeting workflow | Workspace-safe routes and permissions | QA invite/meeting | PENDING |
| NOT-01 | User | In-app, preferences, push subscribe/unsubscribe | Correct recipient, dedupe, deep link and read state | Test notification | PENDING |
| PAY-01 | User | Plans, checkout success/failure, webhook replay, cancellation | Sandbox only; server-owned prices; idempotent entitlement | Sandbox transaction | BLOCKED until test mode is confirmed |
| ENT-01 | Guest/free/subscribed/expired | Direct-route and API access matrix | No entitlement bypass or source leakage | None | PENDING |
| ADM-01 | Admin | Command Centre, verification, discovery, source rights, AI and outreach | Server-enforced super-admin access | None | IN PROGRESS |
| DATA-01 | Admin | GHANEPS OCDS parsing, health, dry run and dedupe | No uncontrolled crawl/import; attribution correct | Safe no-change only | PENDING |
| CF-01 | Public/internal | Turnstile, controlled rate-limit and internal-secret probes | Fail closed without affecting legitimate users | Controlled requests | PENDING |
| AI-01 | User/admin | Assistant, tender analysis, routing and provider fallback | Grounded output; no private leakage/cache mixing | Test prompts | PARTIAL — live safety rejection passes; title-only grounded fallback fixed locally, deployment retest pending |
| ERR-01 | All | Invalid IDs, expired links and failed operations | Useful error state; no blank page/stack leak | None | PENDING |
| RESP-01 | All | 360, 390, 768 and desktop key routes | No unintended horizontal overflow; controls reachable | None | PARTIAL — 360px public signup/plans/legal/contact pass; missing mobile primary navigation fixed locally; remaining viewports/routes pending |
| A11Y-01 | All | Keyboard, labels, focus, dialogs and headings | Operable and named controls | None | PENDING |
| PERF-01 | Public/authenticated | Home, search, detail, dashboards and login | Record current response and Web Vitals evidence | None | PENDING |
| SEC-01 | Supplier/buyer/admin | Cross-account/API/private-file isolation | No role, tenant, payment or verification escalation | Controlled probes | PENDING |
| LOG-01 | Operations | Browser console, Vercel, Supabase and Worker logs | No recurring production errors correlated to journeys | None | PENDING |
| CLEAN-01 | Operations | Remove/archive every QA artifact | No misleading public QA data remains | Cleanup | PENDING |

## Evidence log

- `2026-09-24`: security-hardening release `b41a4d9` deployed. Live supplier-verification admin route reloaded successfully with the authorised builder account.
- `2026-09-24`: production Supabase function privileges/search paths and duplicate-index removal were verified after migration.
- `2026-09-24`: logged-out homepage, pricing, terms, privacy and contact rendered without browser-console errors. The live homepage showed 943 active opportunities, 388 recently added, 295 closing this week and 12 monitored sources.
- `2026-09-24`: logged-out Ghana catalogue returned 55 records. A tender-detail preview exposed title, category, Ghana location and deadline while withholding buyer, source, reference, documents and application links behind the signup prompt.
- `2026-09-24`: supplier signup exposed account-type selection, legal consent, password confirmation and Turnstile. Empty and malformed submissions were stopped by client validation; no QA account was created.
- `2026-09-24`: 360px checks found no horizontal overflow on signup, plans, terms, privacy or contact. A P2 navigation defect hid Tenders, supplier, buyer, plans and services links; an accessible mobile menu and regression test were added locally.
- `2026-09-24`: authenticated Opportunity Discovery showed GHANEPS OCDS as separately attributed structured open data and kept the generic rights-controlled crawler and auto-publication disabled. Rights-unknown crawler sources remained disabled.
- `2026-09-24`: authenticated AI provider diagnostics showed Groq, OpenRouter and Cloudflare Workers AI active; Gemini offline and OpenAI rate-limited. A live tender prompt correctly triggered the unsupported-claim safety guard, but its conservative fallback ignored an available official title. The title-grounding defect was fixed locally with regression coverage.
- `2026-09-24`: an authenticated save persisted across navigation into Saved. Pressing Saved incorrectly repeated the save operation instead of deleting it; a true POST/DELETE toggle and regression test were added locally.
- `2026-09-24`: after the three fixes, 278 backend tests, lint, TypeScript and the 77-page production build passed.

## Release decision

`NOT YET DETERMINED` — pending completion of the live journeys above.
