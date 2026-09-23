# Cloudflare integration audit — 23 September 2026

## Existing infrastructure

- BidScope's public site is deployed on Vercel, with Supabase for auth and data. Public DNS uses Fasthosts `livedns.co.uk` nameservers; `www` points to Vercel DNS. The Cloudflare account has no BidScope domain zone. Production responses identify Vercel and show no `CF-Cache-Status`. Therefore Cloudflare CDN, cache rules, Brotli, HTTP/3, Early Hints and Crawler Hints cannot be applied to the site without a separately planned DNS/proxy change. No such change is authorised by this work.
- Cloudflare Workers Free is the current account plan. The existing `bidscope-opportunity-discovery` Worker has a 30-minute Cron Trigger, a server-side secret, Workers logs and zero recent errors. Preserve it. Vercel also has existing daily procurement, notifications, outreach and lifecycle crons and a monthly GHANEPS OCDS check.
- The Cloudflare account has no Queues. BidScope already stores and processes AI, outreach and notification jobs in Supabase, with retry/idempotency mechanisms. Do not duplicate these merely to use Queues.
- No Turnstile integration was found. Password signup/signin and password recovery are served by Vercel route handlers before calling Supabase Auth. The page also offers Google OAuth. Forms and sensitive API routes need a selective server-side protection strategy.
- AI requests go from Vercel server code directly to Groq, Gemini, OpenRouter and OpenAI. The orchestrator already has provider fallback, quotas, usage logs and an application cache. Sensitive/user-specific input must not be shared through any gateway cache; its existing app cache also needs review.
- Next.js sets CSP and security headers globally. Authenticated API routes generally return `private, no-store`, while public static pages use Vercel caching. This is the correct origin to preserve until a safe Cloudflare proxy design exists.

## Safe additions and reuse plan

1. Add Free-plan Turnstile to selected public auth requests with mandatory server-side Siteverify. Create the widget in the existing account and keep its secret in Vercel only. Do not challenge harmless navigation or force a challenge on every signed-in action.
2. Reuse the existing discovery Worker and Vercel crons. Add no redundant Cron Trigger or Queue until a specific workload and end-to-end consumer/retry design justify it. Cloudflare Workers Free allows five Cron Triggers per account and Queues include 10,000 daily operations with 24-hour retention.
3. Create an AI Gateway only with caching and request/response logging disabled, and a tested direct-provider fallback on transport failure. Keep the current models and provider keys server-side. Cloudflare AI Gateway Run tokens are account-scoped, not gateway-scoped; only the BidScope server receives this token.
4. Improve safe origin-level static caching/image delivery and audit private cache isolation. Do not alter nameservers, DNS, Cloudflare proxy, Vercel hosting or Supabase.

## Baseline (single external sample, not Web Vitals)

`curl` from this workstation: homepage 200, TTFB 0.408 s, transfer 46,896 bytes; `/tenders` 200, TTFB 0.941 s, transfer 126,381 bytes; `/sign-in` 200, TTFB 0.354 s, transfer 38,360 bytes. LCP, CLS, INP, full request count and JavaScript transfer size were not measured by this sample. Re-measure the same endpoints after any deployment; do not claim a user-perceived speedup from these numbers alone.

## Implementation status

- Created Free-plan gateway `bidscope-ai` with authenticated requests and logging, caching, rate limiting and retry disabled. Rotated the initial gateway token after it appeared in a tool readout; saved only the replacement as a Vercel Production secret. A deployment is required for it to take effect.
- Provider-native Groq, Gemini, OpenRouter and OpenAI requests use the gateway only when both server-side Cloudflare account ID and gateway token are present. Original provider credentials remain server-side. A gateway transport failure falls back to the direct provider endpoint; an HTTP error does not trigger a same-provider retry, which could duplicate a billable request.
- Shared application AI caching is now restricted to anonymous, non-sensitive tender summary/extraction inputs. Identified users, organisations, private documents and sensitive inputs neither read nor write the shared cache. The plan is included in public cache keys.
- Turnstile server-side Siteverify, CSP allowances and a managed sign-in/signup/reset widget are implemented and tested for valid, invalid, expired/reused, missing and verification-outage responses. The Free-plan `BidScope production auth` widget now exists for `bidscopeghana.com` and `www.bidscopeghana.com`, with Managed mode and pre-clearance off. Both keys were saved as Vercel Production secrets, never to Git. The integration is inert with both keys absent; partial configuration fails closed. No claim of live protection until the code is deployed and the production human flow is tested. Google OAuth and authenticated buyer/supplier operations were deliberately left outside this challenge pending endpoint-specific abuse evidence.
- No Cloudflare Queue was added because the existing Supabase-backed jobs remain the owned production flow. No Cloudflare CDN/proxy DNS change was made.
