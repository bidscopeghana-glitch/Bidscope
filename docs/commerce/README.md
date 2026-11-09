# BidScope commerce preview

Isolated conversion preview. Checkout and supplier purchases remain disabled. No production database changes have been applied.

## Identity and architecture
- Repository: bidscopeghana-glitch/Bidscope; GitHub main checked at 600dc10.
- Branch: codex/bidscope-commerce-preview. No push or deployment.
- Intended existing hosting: Vercel bidscope-ghana/bidscope.
- Intended existing database: BidScope Supabase bclyhnbzbgugfmxrtlvu.
- All new work is in this isolated BidScope checkout. OdoMatch is out of scope.
- Existing app: Next.js 16.3.4 / React 19, server-side Supabase REST,
  organisation accounts, Paystack subscription/verification ledgers, shared
  notifications, scheduled processing and super-admin controls.

## Preview
Run npm ci, then npm run dev -- --port 3012 --hostname 127.0.0.1.
Open http://127.0.0.1:3012/shop.
The local branch homepage also opens shopping. The original tender landing
component is retained at /tender-archive. These changes are not deployed.
For browser acceptance tests, install the isolated test tool with
npm install --prefix outputs/browser-tools --no-save --package-lock=false @playwright/test,
then run node scripts/test-commerce-preview.mjs while port 3012 is running.
The test opens a fresh Chrome profile and blocks all non-local requests.
The preview has its own shopping navigation and original sample illustrations,
search/category filters, product dialogs, variants, quantities, bag, cost estimate,
wholesale enquiry, simulated checkout, local order history, fulfilment controls,
tracking, cancellation/return requests, refunds, local support and policy drafts.
Administration is a labelled sample workspace, not a production admin endpoint.
Sample data persists only in browser localStorage under bidscope-shopping-samples-v1.
Pricing and publication controls are session-only. Clear that key to reset orders.

## Reuse and separation
The existing BrandLogo, requireUser, requireSuperAdmin, supabaseRest,
createNotification and Paystack signature verifier are reused. Product money
must never be credited to tender subscriptions or supplier-verification payments.
The account API can read the new customer-owned orders after storage is explicitly
configured. Order notifications reuse the existing channel preference system and
remain disabled until integration testing. The preview uses a separate catalogue;
old tender search/categories retain their original data and behaviour.

## What is and is not integrated
The CJ candidate adapter uses only official API origins, supports approved-product
reads, stock, freight, sandbox order creation and order polling. Sandbox creation
always sends isSandbox=1 and payType=3, so it cannot debit a supplier balance.
It has no live payment method or automatic write retries. A timeout is ambiguous:
query the existing merchant reference before deciding to submit again.
The adapter has been tested with fixture transport, not a CJ account.
The Alibaba interface is reserved; the factory rejects calls until partner access,
scopes and official integration details have been established.

No real catalogue was imported and no supplier images were republished.
No CJ/Alibaba account permissions, publication grants, Ghana business eligibility,
Ghana shipping routes, actual inventory or supplier balances have been verified.
No signed supplier webhook receiver is enabled: polling is the intended first path
until the account's webhook authentication contract can be tested.
Token issuance/refresh, raw supplier normalisation, durable catalogue sync workers,
durable order orchestration, customer-payment initialization, refund submission and
provider-specific return workflows still require implementation and validation
against the authorised account. The current provider methods return raw responses
for review; they do not automatically publish those responses.

## Database rollout
1. Export a full database backup and record tender/customer/payment row counts.
   Restore to a separate staging project and verify that restore first.
2. Review schema.sql. It creates a separate commerce schema, unique source mappings,
   ledgers, orders, shipments, refunds, jobs, support, source rights and audit records.
   It does not update, move or delete any existing table.
3. Apply to staging only. Configure the commerce PostgREST schema and review grants.
   Run multi-account RLS, concurrency, payment replay, reconciliation, refund-limit,
   shipment-allocation and worker lease tests before any production application.
4. Keep BIDSCOPE_COMMERCE_STORAGE_READY=0 and notifications disabled until the
   staging account flow is verified. Checkout returns 503 unconditionally.
5. Only after an approved launch plan, import authorised catalogue products into
   draft, verify media permissions, review each product, shipping and margin, then
   approve publication. Do not populate production with the sample catalogue.

## Tender archive and old URLs
Existing tender records and routes are preserved in place, with existing access
controls, as the initial logical archive. Physical moves and deletion are unnecessary.
Before the public conversion, inventory sitemap, /opportunities/*, /public-tenders,
/private-tenders, /tenders/*, /customer/opportunity/* and paid subscription URLs.
Decide record-by-record whether to keep an archive page or return 410 with an
explanation. Redirect only when a genuinely equivalent destination exists; never
redirect every old tender to unrelated shopping products.
The production site, tender schedules and subscription billing have not
been changed. Their retirement and existing subscriber treatment require a separate
approved cutover. The sample shop is noindex.

## Rollback
For this unpublished code, stop the preview and return to the previous branch.
The production site is unaffected. Do not discard unrelated work.
For a future deployed conversion, restore the prior reviewed application commit,
disable commerce checkout/workers/notifications, and reconcile any accepted money
and supplier orders. Do not simply reverse paid transactions or delete ledgers.
After backup and reconciliation, rollback.sql renames commerce to
commerce_archived_v1 and revokes application access, preserving all records.
Resolve any existing archive schema name collision before running it.
Restore by renaming it back and restoring the reviewed grants. Recheck RLS.

## Required credentials and decisions
- CJ approved account and API access, short-lived server token and expiry,
  reviewed key exchange/refresh process, scoped product/media publication evidence,
  explicit destination/route tests and supplier funding arrangement.
- Alibaba authorised partner/OAuth approval and scoped documentation later.
- Paystack test credentials for the commerce ledger; business/model eligibility and
  supported GHS payment channels confirmed with Paystack before live activation.
- Contracting seller/legal identity, BidScope role, destination markets, prohibited
  goods, compliance checks, FX source/expiry, margin policy, fee disclosure,
  duty/tax payer and importer of record.
- Supplier payment funding, reconciliation owner, price-change/refund rules,
  cancellation/return process, customer support ownership and old subscriber plan.
- Reviewed terms, privacy and shipping/returns pages; see legal-review.md.

## Official references checked 9 November 2026
- CJ development: https://developers.cjdropshipping.com/en/api/start/development.html
- CJ sandbox: https://developers.cjdropshipping.com/en/api/start/sandbox.html
- CJ products: https://developers.cjdropshipping.com/en/api/api2/api/product.html
- CJ orders: https://developers.cjdropshipping.com/en/api/api2/api/shopping.html
- CJ logistics: https://developers.cjdropshipping.com/en/api/api2/api/logistic.html
- CJ terms: https://cjdropshipping.com/user-agreement/en
- Alibaba authorised dropshipping: https://sale.alibaba.com/p/drrg0ieho/index.html
- Paystack verification: https://paystack.com/docs/payments/verify-payments/

API availability and public documentation do not establish approval for BidScope.
CJ documents explicitly require isSandbox=1 because the default is a real order.
Alibaba describes account authorisation through approved dropshipping partners;
this does not establish that BidScope is an approved partner.
