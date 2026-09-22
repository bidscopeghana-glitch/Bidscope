# BidScope Web Push operations

BidScope uses native Web Push with VAPID and its existing `notifications` and `notification_deliveries` tables. The versioned schema change is `20260922193128_web_push_notifications.sql`.

Production variables:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: VAPID application-server public key (exposed to browsers by design).
- `VAPID_PRIVATE_KEY`: matching private key. Server only; never use a `NEXT_PUBLIC_` prefix.
- `VAPID_SUBJECT`: contact URI such as `mailto:hello@bidscopeghana.com`.
- Existing `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `CRON_SECRET` remain required.

Generate a key pair once with `web-push.generateVAPIDKeys()`; keep the public/private pair together. Rotating the key invalidates existing browser subscriptions, so users must enable push again. Do not log or commit the private key.

`/api/internal/notifications/push` is called by Vercel Cron every five minutes and requires the existing scheduler bearer secret. The route handles meeting reminders and up to 50 queued push deliveries. Push-service HTTP acceptance is recorded as `sent` at the notification-delivery level and `accepted` per device; neither means the phone displayed the notification. Invalid endpoints (404/410) are disabled. The worker intentionally caches no private pages.

Lock-screen payloads are generic. Tender titles, eligibility, bid content, message text, and billing details remain behind the existing authenticated destination. In-app records retain unread/read state independently of push delivery.

To validate a browser: sign in, open Customer → Alerts, choose **Enable notifications**, confirm browser permission, check the device list, send a test notification, and click it. For iOS/iPadOS, first install BidScope to the Home Screen and open the installed app. Test on physical iOS hardware before claiming iPhone support is verified.

Rollback: redeploy the previous application build to stop new push sends, then disable the push Cron entry. Preserve subscription tables while investigating so users do not lose their device registrations. Dropping the tables is not part of the normal rollback.
