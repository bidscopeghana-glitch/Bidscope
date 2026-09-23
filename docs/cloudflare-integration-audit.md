# Cloudflare integration audit — 23 September 2026

This is an audit of the current BidScope repository and the signed-in Cloudflare account, not a claim that all Cloudflare controls are live. Vercel remains the web origin and Supabase remains the database and private-file store. No production DNS change or paid activation was made.

| Area | Existing BidScope mechanism | Decision | Reason / next gate |
| --- | --- | --- | --- |
| Web protection | Turnstile on password and recovery endpoints; OTP cooldown/IP cap; AI per-user daily allowance and spend budget; signed payment, SMS and email webhooks | **Reuse + extend later** | Keep app limits and webhook signatures. Cloudflare WAF cannot protect the production hostname until its traffic is proxied through an active zone in the audited account. Design endpoint-specific, observe-first rules after a DNS/origin review. Do not challenge webhooks or auth callbacks indiscriminately. |
| Admin access | `requireSuperAdmin` on admin API routes and an admin shell session check | **Do not touch** | Cloudflare Access can only be a second layer. The audited Zero Trust account has no Access application. Trial a separate internal route and identity before any enforcement on admin paths. |
| Opportunity discovery | Cloudflare Worker/Cron/Browser Rendering plus source-rights and crawl safety controls | **Reuse** | Do not bypass source-reuse controls or increase crawl volume as a side effect of this integration. |
| Private procurement documents | Supabase Storage `procurement-private` bucket; server-side upload/download checks | **Do not touch** | Keep sensitive buyer/supplier files with existing authorization. |
| Outreach imports | Supabase Storage `outreach-imports` private bucket | **Do not touch** | Do not migrate prospect/contact data to a new store merely for egress savings. |
| Public/generated assets | Repository/static assets and existing generation flows | **Evaluate R2 later** | R2 is not activated in the audited account. Activation requires accepting a renewing subscription with potential overage billing. No bucket, key, public endpoint, or migration was created. Candidate use is new, non-sensitive generated reports after a storage abstraction and access tests exist. |
| AI orchestration | Existing Gemini, Groq, OpenRouter, OpenAI and Cloudflare adapters; Gateway transport; per-task routes, usage logs, budgets and fallback | **Reuse + narrow** | The previous migration appended Workers AI to all AI routes. A server-side task guard and follow-up migration remove it from customer-facing routes. The existing providers retain core help and tender analysis. |
| Lightweight classification | Existing deterministic tender/category and company keyword classifiers | **Do not replace yet** | A model should only assist review where deterministic evidence is ambiguous. A future `public_tender_classification_review` job should use minimal public factual metadata, require confidence/validation and human review, and never auto-publish model output. No new inference job was enabled in this change. |

## Cloudflare account findings

- The account's **Domains** overview showed no domain zones. This does not prove another Cloudflare account is not involved; it means this account could not be verified as the live proxy for `bidscopeghana.com`. No WAF request counts or rate-limit action is available here.
- R2 opened an activation/plan checkout screen, not a bucket list. The free included allowance is not a hard no-cost guarantee once exceeded. No subscription was activated.
- Zero Trust opened its initial setup screen. No Access application or approved staff identity was verified.
- Existing Workers AI connection can be checked from the AI provider panel; a healthy token alone does not validate answer quality or make a customer-facing task safe.

## Required rollout gates

1. **WAF/rate limits:** establish which hostnames, including `www`, apex and API callbacks, will pass through Cloudflare while Vercel remains origin. Capture baseline traffic and error rates. Apply per-route observe-first rules, conservative bursts and sustained limits, with care for shared carrier IPs. Verify OAuth, Supabase callback, Paystack/Resend/Arkesel webhooks, cron and Worker calls before enforcing. Preserve signature validation at origin.
2. **Access:** define an approved admin/staff identity list; protect a dedicated staging/internal route; test login, logout, re-entry, Vercel origin reachability and app `requireSuperAdmin`. Do not put all `/admin` behind an untested policy.
3. **R2:** obtain explicit approval for activation, verify current allowance/cost, create a private bucket and least-privilege credentials, add one storage abstraction, then test public/private upload, authorization, short-lived download, expiry, deletion, failures and cost metrics. Start with new non-sensitive files only, retaining originals.
4. **Workers AI:** add a review-only, queue-based public-tender classification task with input minimization, schema validation, confidence threshold, fallback/manual review, idempotency and budget ceiling. Test against labelled Ghana tender examples before enabling a route. Keep user-facing assistant and tender decision analysis on established providers.

## Observability and verification boundary

The command centre's Cloudflare section states the audited infrastructure state and reuses authenticated AI usage logs. It does **not** invent WAF block counts, Access denials or R2 object counts. AI usage logs count a bounded monthly window and all-provider fallbacks; they are not Cloudflare edge metrics. Secret values and document contents are not exposed by this panel.

No claim of complete end-to-end production verification is possible until an active proxied zone, approved Access policy and activated R2 are present and actual buyer/supplier/file flows can be exercised in production with test accounts.
