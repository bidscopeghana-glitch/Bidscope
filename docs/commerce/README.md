# BidScope commerce preview

Isolated conversion preview. Checkout and supplier purchases remain disabled. The separately approved private catalogue table has been created in BidScope Supabase; historical tables remain unchanged.

## Identity and architecture
- Repository: bidscopeghana-glitch/Bidscope; GitHub main checked at 600dc10.
- Branch: codex/bidscope-commerce-preview, pushed to GitHub for review. No public commerce deployment.
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
The order adapter has fixture coverage and a completed official CJ sandbox pilot. No real supplier purchase or shipment has been made.
The Alibaba interface is reserved; the factory rejects calls until partner access,
scopes and official integration details have been established.

No public catalogue has been approved or published. An opt-in local-only CJ
storefront feed can now show actual supplier products and images for design review.
CJ API authentication and limited product/route reads have been verified as
described below. Publication grants, Ghana business eligibility, supplier balances
and Alibaba permissions remain unverified. Reported stock is not independently
verified or reserved, and one available route does not establish catalogue-wide coverage.
No signed supplier webhook receiver is enabled: polling is the intended first path
until the account's webhook authentication contract can be tested.
Raw supplier normalisation, durable catalogue sync workers,
durable order orchestration, customer-payment initialization, refund submission and
provider-specific return workflows still require implementation and validation
against the authorised account. The current provider methods return raw responses
for review; they do not automatically publish those responses.

### CJ connection setup added 9 November 2026
The CJ account's BidScope-Commerce-Sandbox key was created with explicit approval.
Authentication was verified against the official CJ token endpoint and rechecked
using the saved local server credential. The key is not a provider-scoped sandbox
credential; BidScope's adapter enforces sandbox order requests and has no balance
payment method. Product/media publication and Ghana routes remain unverified.

The server token manager handles token exchange, in-memory caching, single-flight
concurrency, refresh and failure cooldown. No token or key is returned to clients.
The local setup screen is /shop/integrations. It requires the explicit runtime
flag BIDSCOPE_COMMERCE_LOCAL_SETUP=1 and loopback Host / same-origin JSON checks.
It saves the key under .codex-tmp/commerce/cj-credential.json, ignored by Git.
It is a local workstation setup flow, not a public admin credential endpoint.
Disable this flag outside local development. For a future reviewed deployment,
put CJ_API_KEY in the hosting secret manager; never publish the local credential
file or commit credentials. Existing super-admin API responses expose status only.

### Private CJ catalogue review
`/shop/integrations` now includes official V2 keyword search, product/variant
inspection and a Ghana freight check. The separate local-only inspector reads the
connected account without treating that as publication approval. It returns a
strict allowlist of fields, never supplier HTML, media or credentials. Stable
BidScope mappings retain CJ product and variant IDs and supplier costs in USD cents.
The review does not save or publish products, and does not replace the sample shop.
It re-fetches the product to validate variant ownership, checks reported inventory
at the selected origin, then requests Ghana freight estimates. Factory stock is
distinguished from CJ warehouse stock. Missing tax or clearance amounts stay
unknown; an empty route list is not treated as Ghana coverage. Estimates are
timestamped, not delivery guarantees, and stock is not reserved.

`POST /api/commerce/local-catalogue` uses the same explicit local-setup and
same-origin restrictions as credential setup, validates bounded inputs and limits
concurrent requests. Only keyword search, product reads, inventory reads and the
freight calculation endpoint are exposed. There are no order/payment/publication
actions. Leave the local-setup flag disabled on public hosts. No database migration
is needed for this private review. Roll back these changes with the app commit;
there are no catalogue rows or external orders to reverse.

Live read-only acceptance on 9 November 2026 verified the saved CJ credential,
searched `desk lamp` and inspected product `4D76667F-8B43-447D-8E7E-55E753ED323A`
(CJJZSNSN00624). CJ returned three variants. For the first variant, quantity one,
CN to GH, it reported factory stock (zero CJ warehouse stock) and three freight
options: USD 12.64, 14.40 and 16.10. These are historical API estimates, not prices
to promise customers. No supplier order, customer charge or publication occurred.
The review screen was also checked at 390px width without horizontal overflow.
Validation: 377 backend tests pass, including seven new CJ catalogue cases;
lint, TypeScript and the production webpack build pass. Local HTTP checks reject
cross-site catalogue access (403), unsupported publication actions (400), and live
checkout (503). The build also required removing an unused helper export from the
existing notification route, which Next.js disallows; processing behaviour is unchanged.

### Real items in the local storefront
Run `BIDSCOPE_COMMERCE_LOCAL_SETUP=1` with Node's environment mechanism, then
`node --experimental-strip-types scripts/prepare-cj-preview.mts`. On PowerShell,
set `$env:BIDSCOPE_COMMERCE_LOCAL_SETUP='1'` first. The script performs bounded,
serialised official API reads and writes `.codex-tmp/commerce/cj-preview.json`.
It never creates orders or modifies the CJ account. The feed and credential files
are ignored by Git and are not sent to GitHub. API calls are paced for CJ's free-tier
one-request-per-second limit. Unsupported products/media are skipped.

The opt-in loopback-only `/api/commerce/local-catalogue/feed` endpoint validates and
allowlists the saved feed. The shop uses it in place of the sample collection,
including actual product photos, categories, variant mappings and USD reference
prices. It rejects image hosts outside the reviewed CJ media allowlist, treats stock as unverified, keeps public
publication permission unknown and prevents real products entering sample checkout.
No GHS selling price, confirmed origin or delivery promise is invented. Supplier
photos remain external and lazy-loaded; they are not copied into the repository.
Public media rights still need review against the current account agreement; CJ's
older published dropshipping policy is not treated as proof of current account approval.
If the feed is missing or local setup is disabled, the clearly labelled sample
catalogue remains available. Existing sample order history is preserved.

Four products were prepared locally on 9 November 2026: one lamp, two travel bags
and one storage organiser. Their actual photos and variant selection were verified
in the browser. These are private previews, not purchasable listings.
The final revision passes 381 backend tests, lint, TypeScript and the production
build. Browser checks verified all four photos loaded, variant selection worked,
real checkout remained disabled and the 390px mobile layout had no horizontal
overflow. Changing a freight quantity or origin now clears the previous estimate.

GitHub delivery is to `codex/bidscope-commerce-preview` only. Its exact-branch
Vercel auto-deployment setting is disabled in `vercel.json`; no production branch
merge or deployment is authorised. To roll back the real-item preview, unset the
local-setup flag and restart the server, or move the private feed out of that path.
No historical tender records or database structures are changed.

## 50,000-product staging catalogue
The new `/shop/catalogue` browser requests 24 products per page, with server-side
search, category filters and price sorting. It never loads 50,000 products into
React. Actual imported totals are shown separately from the 50,000-product target.
Source price ranges retain both endpoints. Full variants are fetched on request;
unfetched variants are never invented or counted as separate products.

`scripts/sync-cj-catalogue.mts` imports official V2 list metadata into an ignored
local SQLite staging database. Run with `BIDSCOPE_COMMERCE_LOCAL_SETUP=1` and
`CJ_CATALOGUE_BATCH_PAGES=10` for a bounded batch, or up to 1,000 for a longer run.
`CJ_CATALOGUE_TARGET` defaults to 50,000 and cannot exceed that limit. Source category
pagination is capped at the documented 6,000-result window per query, and products
are deduplicated by supplier ID across categories. No scraping, paid quota purchase,
provider order creation, image mirroring or public publication is performed.
If the oldest-first category pass does not reach the target, one newest-first
pass uses CJ's documented create-time sort. It retains the same 60-page limit,
excluded categories, deduplication, quota checks and retry bounds. The direction
is checkpointed; it cannot cycle indefinitely or restart the newer pass on resume.

Each successful page and cursor are committed together. A short worker lease
prevents concurrent importers; expired leases are recoverable. Timeouts and server
errors receive at most three retries with backoff; quota errors receive bounded
one-minute pauses, and 1,000 reported points are reserved for account inspection.
The worker stops on account suspension, invalid provider responses or exhausted
categories. Re-running resumes the last committed page without duplicate products.
All-zero quota placeholders on failed responses do not replace the last valid
quota snapshot. A real zero remaining balance with a positive total is retained;
provider errors still receive only the existing bounded retries.
Remaining categories rotate between departments, preserving the active category's
page cursor, so a large first department cannot occupy the whole catalogue target.
Local browser checks and the background worker share a persisted rate-slot ledger.
Use Ctrl+C for a graceful worker pause; the current read commits before shutdown.
Unsupported media hosts and non-sale products are skipped, rather than replaced
with fabricated listings. An exhausted category set may yield fewer than 50,000.
The media allowlist includes CJ subdomains and two exact auxiliary buckets:
`cj-product-center.oss-accelerate.aliyuncs.com` was returned by the authenticated
official V2 API on 9 November 2026; `cc-west-usa.oss-us-west-1.aliyuncs.com` is used
in CJ's official API documentation. Other Alibaba Cloud buckets are denied.
This allows only private review, without changing publication or stock approval.
The versioned media-policy checkpoint replays an existing catalogue once in newest
order to recover previously skipped records; it preserves stored rows and the cap.

SQLite scale tests use **synthetic fixtures**, not real supplier imports: 50,000
rows, exact deduplication, pagination, literal wildcard handling, injection-looking
search input, target limits and worker lease recovery are verified. Live product
totals must always be obtained from the progress endpoint or database itself.

Supabase staging is defined in `catalogue-staging.sql`, with a separate
reversible retirement script. It creates one new private draft table, indexes and
service-role-only access; it does not modify existing tender, account or payment
tables. Public publication is excluded by the status constraint. The migration was
applied on 9 November 2026 after explicit user approval. RLS, four indexes, denied
anon/authenticated reads and denied service-role deletion were verified in live SQL.
The user separately approved a private backfill of up to 50,000 draft records.
`scripts/mirror-cj-catalogue.mts` performs bounded, idempotent upserts of metadata
only. Rights/publication fields are never included in its payload. Local version
markers are updated only after the cloud write succeeds; a newer local version
remains pending even if an older cloud write completes later. No customer records
or existing tender tables are modified. At the first cloud check, 8,749 rows were
all drafts with rights review pending, using 12 MB including indexes.
On 9 November 2026 the confirmed BidScope project showed 286 MB of its 500 MB
dashboard allowance, and the read-only SQL size check returned 258 MB. Recheck
capacity before any cloud backfill, retaining headroom for the existing site.
No paid Supabase upgrade or production Vercel deployment has been activated.
Run the mirror only with `BIDSCOPE_CATALOGUE_SUPABASE_READY=1` and the confirmed
BidScope server-side Supabase environment. It refuses any other project hostname
and refuses a local catalogue exceeding the approved 50,000-product limit. It can
follow the active importer's persisted lease through temporary quota/read pauses,
up to a bounded wait. It does not infer liveness from error-message wording or a
stale running status after the worker has exited.
The private catalogue refreshes its local 24-row query every 15 seconds while the
worker lease is active, pausing during a product-detail inspection or a fetch
error. This polling does not call CJ. It shows the remaining target, current
category/pass, worker liveness and pause reason. A stopped worker remains resumable;
use Refresh catalogue after restarting it. Initial loading is labelled explicitly
instead of briefly claiming zero products or an unstarted import.

Validation for the bulk catalogue revision: 390 backend tests pass, with no
failures or skipped tests. ESLint, TypeScript and the production webpack build
pass. Browser checks verified header search, 24-item pagination, and no horizontal
overflow at 1,024 px and 390 px. A live service-role count confirmed the cloud
copy contains only draft records with publication rights still pending review.

To roll back the local catalogue, stop its worker and disable local setup. Keep
the SQLite database and its WAL files together for recovery; do not delete them
while the worker is active. Existing tender/customer data is unaffected. The
Supabase rollback script renames its new draft table and revokes access, preserving
records; review any archive-name collision before use.

Alibaba's openapi-account developer profile was incomplete at inspection: legal
company name, registration number, registered address and certificate were missing,
and the country default was China. Complete with the real BidScope legal details
and obtain approval for the intended dropshipping APIs before implementing a
provider-specific credential exchange. A separate 1688 browser page was blocked
by the browser site-safety policy; no alternate access was attempted.

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
- Paystack TEST key is connected locally and a GHS 1.00 hosted sandbox payment was verified. Live commerce merchant eligibility, funding, webhooks and refunds still require validation before activation.
- Contracting seller/legal identity, BidScope role, destination markets, prohibited
  goods, compliance checks, fee disclosure,
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


## Retail and payment pilot update - 9 November 2026

Approved choices: 30% markup on supplier product cost; international destinations
rather than Ghana only; daily USD-to-GHS conversions. The catalogue scan completed
both bounded category passes with 36,555 distinct products, all mirrored to the
approved private Supabase table. There are zero non-draft records and zero rights
promotions. The scan did not achieve 50,000; do not restart it as if more products
are guaranteed or count variants as distinct products.

The customer preview now has larger photo-led product cards, full product pages,
image galleries, supplier variants, current price inspection, destination/origin
checks and a separate persistent real-item shopping bag. CJ is retained as source
provenance rather than a customer marketing headline. No fake ratings, discounts,
stock promises or delivery guarantees were added. Sign-in links reuse existing
BidScope authentication; the production customer order-account flow is not yet wired.

USD prices use the approved markup; indicative GHS quotes are calculated server-side
from the daily ExchangeRate-API open feed. A stale or unavailable rate is rejected,
not silently reused. Attribution is displayed. Its informational rate is not a bank
settlement guarantee. Before live payment, lock a fresh merchant quote with FX,
stock, variant, shipping, duty/tax treatment and expiry in durable order storage.
Official feed documentation: https://www.exchangerate-api.com/docs/free
Terms: https://www.exchangerate-api.com/terms

### Executed sandbox checks
- The existing BidScope Paystack TEST key was copied with explicit approval only to
  the ignored local server-secret file; it is never returned to the browser or Git.
- A fixed GHS 1.00 hosted TEST checkout completed successfully and was verified
  server-side against its known reference, exact amount, currency and success state.
  A second verification returned the existing result without a duplicate operation.
- The Paystack test is deliberately separate from the shopping bag. It does not
  create or pay a supplier order. No real customer charge occurred.
- CJ sandbox order SD2611091946200664600 was created with isSandbox=1 and payType=3.
  Its sandbox identity and merchant reference were queried and reconciled. Official
  sandbox confirmation, simulated payment, processing, labelled tracking, shipping
  and delivery completed; the final provider status was DELIVERED. No CJ balance
  deduction or real shipment occurred. This is a supplier pilot, not proof that the
  end-to-end customer-payment-to-supplier-order production workflow exists.
- The shared SQLite limiter now gates actual request starts, including token
  authentication. Rate-limit replies preserve the saved cursor; uncertain supplier
  writes stop for reconciliation rather than creating another order.
- Desktop and 390px browser checks covered product galleries, variants, an actual
  CN-to-GB freight response, bag quantity changes, reload persistence and removal.
  Review bag navigates without incrementing quantity a second time.
- Final automated results: 399 backend tests passed; lint and TypeScript passed.
  The Next.js production build also passed.

### Local setup and repeat-test safety
Use Node 24. Set BIDSCOPE_COMMERCE_LOCAL_SETUP=1 only on this private loopback
server, then run npm run dev -- --webpack --port 3012 --hostname 127.0.0.1.
Open /shop, /shop/catalogue, /shop/product/{supplierId}, /shop/cart and
/shop/payment-test. The local APIs fail closed on public hosts or without the flag.
The payment page accepts only sk_test_ credentials and a fixed sandbox amount.
Do not put BIDSCOPE_COMMERCE_LOCAL_SETUP=1 on a public deployment.

CJ test creation is opt-in via BIDSCOPE_CJ_SANDBOX_TEST=1 and
node --experimental-strip-types scripts/test-cj-sandbox.mts. It refuses to overwrite
an existing pilot file. For an incomplete existing pilot, inspect the saved audit
then use scripts/resume-cj-sandbox.mts, which never creates an order and verifies
sandbox identity before every mutation. The completed pilot should not be recreated
just to obtain another success screenshot. Keep the ignored local ledgers for
reconciliation; do not upload them with code.

### Remaining launch gates
Customer checkout continues returning 503 unconditionally. Before accepting real
money, implement and validate durable commerce order/payment/refund storage,
signed payment webhooks and replay handling, supplier funding/payment separation,
exception reconciliation, cancellation/returns, split shipments, customer order
history and support. Complete catalogue/product media permission evidence, restricted
product review, destination coverage, merchant eligibility and editable seller,
privacy, shipping, duty/tax and returns disclosures. Alibaba remains unavailable
until official account/API approval is established.

Rollback this unpublished preview by restoring the prior application branch and
stopping the local server. Preserve existing test ledgers and private catalogue.
The separate catalogue rollback SQL archives rather than deletes its table and
must not run blindly or overwrite an existing archive name. No tender records,
existing subscription payment settings or production webhooks were changed by
this pilot. No commerce conversion deployment has been made.


## Saved checkout reviews - 9 November 2026

The real-item bag now links to /shop/checkout. This private preparation step
revalidates up to five selected product options against the official CJ product,
stock and freight endpoints. Each option's current supplier price comes from the
same product read that establishes variant ownership; the approved 30% markup is
applied on the server. Browser prices are rejected as input. Each line is treated
as a separate shipment estimate; combined freight is not assumed. The lowest
returned provider postage is selected unless a specific returned service is named.

The review separates merchandise, freight, provider-reported tax/clearance and
known subtotal. It saves a daily indicative GHS conversion, timestamps and a
five-minute price-review expiry. Unknown payment fees and destination duties/taxes
remain null, and payableGhsMinor remains null. A held review cannot authorise a
charge, reserve stock, create a supplier order or change source permissions.
A full delivery address and reviewed seller/tax/shipping rules are still required
for a production quote. Provider-reported zero tax is not treated as zero import
tax liability.

Saved records live only in .codex-tmp/commerce/checkout-reviews.sqlite. Unique
request keys prevent duplicate preparation after double clicks or browser reload.
Reusing a key for different selections is rejected. The SQLite admission gate
allows only one recent supplier-check operation at a time across processes;
failures are retained for inspection. Expired or failed reviews require an explicit
fresh request. The UI lists the latest 20 local reviews and their held/checking/
failed state. These are workstation review records, not production customer orders
or customer-specific order history. The endpoint requires the same loopback-only,
explicit local setup flag and same-origin checks as the other private tools.

Browser acceptance verified a real two-variant CN-to-GB supplier quote, duplicate
prevention and saved-review retrieval after reload. At that time, merchandise was
USD 8.20, separate provider postage USD 12.17, and known subtotal USD 20.37; those
figures are historical estimates, not a current selling offer. The 390px view had
no horizontal page overflow. Automated coverage includes stale FX/stock, unknown
catalogue mappings, unsupported destinations, invalid quantities, client-price
injection, absent routes, inconsistent postage, expiry, key conflicts, persistence
and cross-connection concurrency. Live customer checkout remains unconditionally
503. No additional production migration, payment, purchase or deployment was made.

To roll back this step, restore the prior application commit a57159f and stop the
private preview. Preserve the local review database for audit/reconciliation;
there is no production schema or supplier operation to reverse. The existing
catalogue and historical tender records are untouched.

Validation for this step: 407 backend tests passed; ESLint, standalone TypeScript
and the production Next.js build all passed. Preview auto-deployment remains disabled.


## Live credential connection setup - 9 November 2026

/shop/payments and /api/commerce/local-live-payments add a separate loopback-only
live-key connection flow. It requires BIDSCOPE_COMMERCE_LOCAL_SETUP=1, validates
same-origin JSON requests and accepts only sk_live_ secret keys. Validation uses
only GET https://api.paystack.co/integration/payment_session_timeout, the official
read-only integration setting endpoint. It never initializes a payment, fetches
customer records or balances, changes Paystack settings or sends a supplier order.
Official reference: https://paystack.com/docs/api/integration/

After explicit owner approval to copy the credential, the verified key is saved
only under .codex-tmp/commerce/paystack-live-key.json, excluded from Git. The API
returns configured state and validation time, never the secret. The existing
TEST key and old subscription key/configuration remain separate. Connection does
not mean live checkout is enabled: the customer checkout route still returns
503 unconditionally. No live credential is packaged with code or automatically
uploaded to Vercel. This is local preparation, not production activation.

Rollback this setup by restoring the previous application commit 5bb43d3 and
stopping the private server. Preserve the credential securely or remove its local
file through an explicit owner-approved cleanup; do not revoke or regenerate the
shared Paystack account key blindly, as other BidScope billing may use it.

Validation: 409 backend tests passed; ESLint, standalone TypeScript and the
production Next.js build passed. The live credential itself is never included
in these source commits or build artifacts.


## Hosted catalogue repair - 9 November 2026

The Vercel preview previously fell back to the fictional sample storefront because
its real feed and catalogue APIs required localhost and read ignored workstation
files. Hosted pages now use a separate Supabase-backed GET /api/commerce/catalogue
endpoint. It checks existing requireSuperAdmin authentication before any server-role
query. It reads only CJ draft/held rows, maps through the existing field/media
allowlist, bounds pagination to 24 and supports full-text search, category filtering,
stable price ordering and single-product lookup. Responses are private/no-store.
No anonymous database policy or publication status was changed.

The hosted home, catalogue and saved product-detail views send the existing
BidScope access token. They show an administrator sign-in state rather than
substituting sample stock when access is unavailable. The local CJ-rich preview
continues to work separately. Hosted detail pages show the saved import record;
current CJ variants, stock and shipping still require the provider server connection.
They do not imply that unreviewed products can be purchased. Local daily FX preview
requests are not sent from the hosted draft views.

Vercel's existing BIDSCOPE_ADMIN_EMAIL variable was extended from Production to
Production and Preview with explicit owner approval. Existing Supabase Preview
variables were already configured and no secret values were revealed. Production
application and DNS remain unchanged. Rollback code to 49a2808 and, if desired,
restore the administrator-email environment scope to Production only. No database
migration, catalogue publication, customer charge or supplier order is involved.

Validation: 412 backend tests passed. ESLint passed and the production Next.js
build (including TypeScript) passed. Read-only live database checks returned
36,555 drafts, 20 desk-lamp matches and the selected lamp record.


### Preview OAuth configuration
With explicit owner approval, Supabase's existing production Site URL and callback
were retained and this exact additional redirect was saved (no wildcard):
https://bidscope-git-codex-bidscope-commerce-preview-bidscope-ghana.vercel.app/auth/callback?next=%2Fshop
Vercel NEXT_PUBLIC_SITE_URL was added as a Config override only for Preview branch
codex/bidscope-commerce-preview, pointing to that stable branch hostname. The
Production value was not edited. This corrects Google returning preview sign-ins
to the production Site URL when the preview redirect was absent from the allowlist.
Rollback these settings by removing only that exact additional Supabase URL and
that branch-scoped Vercel override. Do not remove the production callback or reset
the project's main Site URL. A fresh deployment is required after env changes.
