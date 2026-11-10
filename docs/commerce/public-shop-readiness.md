# Public shop stage — 10 November 2026

BidScope only: `bidscopeghana-glitch/Bidscope`, branch
`codex/bidscope-commerce-preview`, Vercel `bidscope-ghana/bidscope`, Supabase
`bclyhnbzbgugfmxrtlvu`. The main domain remains on the existing tender runtime.
No production cutover, live charge, real supplier purchase or historical deletion
is part of this stage.

## Implemented

- Guest storefront and catalogue at `/shop` and `/shop/catalogue`, with keyword
  search, approved-category filters, price sorting and pagination.
- Public details at `/shop/item/[id]`, with description, mapped variants, cedi
  prices, quantities, bag saving and honest stock/shipping disclosures.
- Private import review retained at `/shop/review` and `/shop/product/[id]`.
- Admin approvals at `/shop/publications`. Each approval requires content/media
  permission evidence, a plain-text description, reviewed origin and expiry.
  The server refreshes official CJ variants/costs under the existing shared gate;
  clients cannot submit their own supplier prices or variant snapshot.
- Separate publication/audit tables with service-only access. Guest APIs return
  an explicit customer-safe projection, never source costs, approval evidence or
  actor identities. Only approved, unexpired records appear. No draft table
  grants are weakened. Retirement preserves the source record and audit trail.
- Draft shopping disclosures at `/shop/policies`. The certificate's personal
  identifiers and residential address are not included.
- The existing TEST refund was visibly verified as processed on the hosted
  operations screen; the previous pending state is resolved. Evidence:
  `outputs/shop-test-refund-processed.png`. No real funds moved.

## Setup in the isolated preview

Activation update: the owner approved and the publication migration was applied
on 10 November 2026 in bclyhnbzbgugfmxrtlvu. SQL verification found 2 RLS-protected
tables, 3 service-only functions and zero publication rows. Both configuration
flags below were saved exclusively for the commerce Preview branch, not
Production. No product approval or live checkout activation was performed.
Evidence: `outputs/shop-publication-schema-verified.png`.

1. Review and apply `20261110120000_shop_publications.sql` only to the identified
   BidScope project. It is additive; it does not copy or publish any imported row.
2. Set `BIDSCOPE_SHOP_PUBLICATIONS_READY=1` in the commerce branch's Preview
   environment after checking schema/RLS/function privileges. The existing
   server-only CJ connection and administrator identity are reused.
3. Review a small launch collection; enter verifiable permission evidence for
   its content and media and approve it through `/shop/publications`. Do not
   mass-approve the private import merely because API credentials work.
4. Set `BIDSCOPE_SHOP_PUBLIC_CATALOGUE=1` in that Preview environment after
   reviewing the approved collection. Until then the guest API intentionally
   returns an empty, preparing collection without querying draft storage.
5. Verify signed-out browse/search/detail/variant/bag and administrator-only
   approval/retirement. Recheck expired and retired items cannot be read.
6. Leave checkout disabled. These catalogue flags cannot activate customer
   charges or supplier purchases.

## Still required before live sales or domain conversion

- Customer-support email confirmed: hello@bidscopeghana.com. Public business
  correspondence address is still unconfirmed.
- Finalise cancellation, return-postage and refund terms. CJ's published dispute
  restrictions include Ghana; obtain written applicable coverage or explicitly
  fund valid customer remedies through BidScope. Do not assume supplier refusal
  removes customer rights. See `legal-review.md`.
- The owner requested warnings and acknowledgement for restricted returns.
  Sandbox quotes now require a separate return-information acknowledgement and
  preserve the disclosure version/text/server timestamp in the quote/order
  fulfilment snapshot. It is not a waiver and does not resolve the funding or
  supplier-coverage decision. A product-specific legally reviewed policy and
  workable remedy remain required before live checkout.
- Approve actual products/media and verify destination/product compliance.
- Complete and validate a separate LIVE order/fulfilment workflow with controlled
  retries, reconciliation, supplier funding and returns. Existing official CJ
  order writes are deliberately sandbox-only; a flag/key must not silently
  convert them into real purchases.
- Verify the customer payment webhook and live refund processing independently
  from tender subscriptions. The completed sandbox flow is not a live acceptance
  test. Obtain authorisation before any real purchase or charge.
- Final privacy notice, actual provider agreements and destination disclosures.
- Only after those steps, explicitly approve the domain conversion and retain
  the prior production deployment for rollback.

## Rollback

Set `BIDSCOPE_SHOP_PUBLIC_CATALOGUE=0`, retire affected approvals if needed, and
restore the previous preview runtime. Disable publication writes by setting
`BIDSCOPE_SHOP_PUBLICATIONS_READY=0`. The optional `rollback-publications.sql`
revokes publication mutation RPC execution; it does not drop tables or audit data.
Reapplying the documented GRANTs restores RPC access. No DNS change is required.

## Checks

- `node --experimental-strip-types --test tests/backend/commerce-storefront.test.ts`
- `node scripts/test-shop-publications.mjs` (isolated existing PGlite test install;
  no live database or provider calls).
- Standard backend suite, full lint, TypeScript and Webpack production build.
- After adding the required returns acknowledgement and confirmed support email:
  433 backend tests, full lint and production build (including TypeScript) passed.
- Browser: signed-out collection/preparing state, unpublished item rejection,
  policy page; desktop and phone width checks. No approved product has yet been
  published in Supabase by this stage, so live approval-to-guest acceptance is
  still pending activation rather than claimed complete.
