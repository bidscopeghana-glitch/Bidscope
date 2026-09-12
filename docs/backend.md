# BidScope backend

This is the production MVP backend for the Ghana launch. Supabase provides Postgres, authentication and row-level security; Next.js route handlers provide the public and authenticated API; Vercel runs the application and scheduled/internal jobs.

## Domain model

- `profiles`, `organizations`, `organization_members`: user and business tenancy
- `procuring_entities`: searchable government-buyer records
- `opportunities`, `opportunity_documents`: public tender notices and official documents
- `awards`, `award_suppliers`: historical award research
- `saved_opportunities`: private watchlist and bid pipeline
- `alert_rules`, `alert_deliveries`: personalized opportunity matching and delivery history
- `subscriptions`, `webhook_events`: provider-neutral access and billing state
- `ingestion_sources`, `ingestion_runs`: auditable automated collection
- `audit_log`: organization-level accountability

All organization-owned data is protected with row-level security. Public users may read only published opportunity, buyer and award data. The service-role key is server-only.

## API surface

Public:

- `GET /api/opportunities` — filters: `q`, `country`, `status`, `category`, `sector`, `region`, `buyer`, `sort`, `page`, `pageSize`
- `GET /api/opportunities/:slug`
- `GET /api/buyers` and `GET /api/buyers/:slug`
- `GET /api/awards`
- `POST /api/founding-members`
- `GET /api/health`

Authenticated Supabase bearer token:

- `GET|POST /api/organizations`
- `GET|PATCH /api/me`
- `GET|POST|DELETE /api/saved-opportunities`
- `GET|POST /api/alerts`
- `PATCH|DELETE /api/alerts/:id`
- `GET /api/subscription`

Trusted internal bearer token (`BIDSCOPE_INTERNAL_SECRET`):

- `GET|POST /api/internal/sources`
- `POST /api/internal/ingest`
- `POST /api/internal/ingest/buyers`
- `POST /api/internal/ingest/awards`
- `POST /api/internal/alerts/run`
- `POST /api/internal/subscriptions/sync`

## Deployment order

1. Apply both Supabase migrations in timestamp order.
2. Configure the environment variables listed in `.env.example` in Vercel.
3. Register at least one ingestion source through the internal sources endpoint.
4. Connect a lawful source adapter to the normalized buyer, opportunity and award ingestion endpoints.
5. Schedule opportunity imports and `/api/internal/alerts/run` in Vercel Cron or an external scheduler.
6. Configure a verified sending domain and the Resend variables when email delivery is ready.
7. Connect a payment provider by validating its webhook at the edge, then forwarding normalized state to the subscription sync endpoint.

No scraper credentials, payment credentials, or email-provider credentials belong in the repository.

## Verification

Run:

```sh
npm run test:backend
npm run lint
npm run build
```

`GET /api/health` verifies the deployed application can reach the migrated Supabase database.
