import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(path:string)=>readFileSync(path,"utf8");

test("SMS is server restricted to the six approved transactional events",()=>{
  const sms=read("lib/server/sms.ts");
  const expected=["bid_received","meeting_reminder","bid_awarded","otp_verification","matching_tender","watched_tender_closing"];
  for(const event of expected)assert.match(sms,new RegExp(`"${event}"`));
  assert.match(sms,/SMS_EVENT_ALLOWLIST\.has\(input\.eventType\)/);
  assert.match(sms,/recipient_masked/);
  assert.match(sms,/dedupe_key/);
  assert.doesNotMatch(sms,/NEXT_PUBLIC_ARKESEL/);
});

test("phone verification uses hashed expiring OTPs with cooldown and rate limits",()=>{
  const request=read("app/api/phone/verification/request/route.ts");
  const confirm=read("app/api/phone/verification/confirm/route.ts");
  const migration=read("supabase/migrations/20260920183000_unified_sms_notifications.sql");
  assert.match(request,/randomInt\(100000,1_000_000\)/);
  assert.match(request,/createHmac\("sha256"/);
  assert.match(request,/60_000/);
  assert.match(request,/otp_rate_limited/);
  assert.match(confirm,/timingSafeEqual/);
  assert.match(confirm,/attempts>=5/);
  assert.match(migration,/expires_at timestamptz not null/);
  assert.doesNotMatch(migration,/\bcode\s+text\b/);
});

test("existing users are not silently opted into SMS",()=>{
  const migration=read("supabase/migrations/20260920183000_unified_sms_notifications.sql");
  assert.match(migration,/select u\.id,kind,kind <> 'otp_verification',kind <> 'otp_verification',false,'instant'/);
  assert.match(migration,/sms_enabled boolean not null default false/);
});

test("Arkesel callbacks are authenticated and delivery status is persisted",()=>{
  const sender=read("lib/server/sms.ts");
  const webhook=read("app/api/webhooks/arkesel/route.ts");
  assert.match(sender,/api-key/);
  assert.match(sender,/callback_url:callbackUrl\.toString\(\)/);
  assert.match(webhook,/delivery-callback/);
  assert.match(webhook,/timingSafeEqual/);
  assert.match(webhook,/provider_message_id/);
});

test("transactional workflows enqueue the correct SMS-capable events",()=>{
  const procurement=read("app/api/procurement/route.ts");
  const search=read("lib/server/customer-search-alerts.ts");
  const scheduled=read("lib/server/scheduled-sms-alerts.ts");
  assert.match(procurement,/type:\s*"bid_received"/);
  assert.match(procurement,/type:\s*"bid_awarded"/);
  assert.match(search,/type:\s*"matching_tender"/);
  assert.match(scheduled,/type:\s*"meeting_reminder"/);
  assert.match(scheduled,/type:\s*"watched_tender_closing"/);
});

test("SMS reminders run frequently without rerunning all daily engagement work",()=>{
  const config=read("vercel.json");
  const reminders=read("app/api/internal/notifications/reminders/route.ts");
  const daily=read("app/api/internal/notifications/process/route.ts");
  assert.match(config,/notifications\/reminders/);
  assert.match(config,/\*\/10 \* \* \* \*/);
  assert.match(reminders,/generateMeetingReminders/);
  assert.match(reminders,/processPendingDeliveries/);
  assert.doesNotMatch(daily,/generateMeetingReminders/);
});

test("alert centre preserves every existing preference and gates SMS by provider and verification",()=>{
  const page=read("components/customer/pages.tsx");
  const api=read("app/api/notification-preferences/route.ts");
  assert.match(page,/r\.data\?\.data\.map\(\(p\)/);
  assert.match(page,/SMS not available for this event/);
  assert.match(page,/Resend in \$\{resendSeconds\}s/);
  assert.match(api,/sms_event_not_allowed/);
  assert.match(api,/phone_verification_required/);
});
