import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file: string) => readFileSync(file, "utf8");

test("web push migration keeps credentials owner-scoped and device delivery private", () => {
  const sql = read("supabase/migrations/20260922193128_web_push_notifications.sql");
  for (const table of ["push_subscriptions", "push_event_preferences", "push_device_deliveries"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(sql, /unique \(notification_id, subscription_id\)/);
  assert.match(sql, /using \(\(select auth\.uid\(\)\) = user_id\)/);
  assert.match(sql, /revoke all on public\.push_device_deliveries from anon, authenticated/);
});

test("push worker has safe notification click handling and no private cache", () => {
  const worker = read("public/bidscope-push-sw.js");
  assert.match(worker, /showNotification/);
  assert.match(worker, /notificationclick/);
  assert.match(worker, /target\.origin !== self\.location\.origin/);
  assert.match(worker, /self\.clients\.matchAll/);
  assert.doesNotMatch(worker, /caches\.open|cache\.put/);
});

test("push delivery uses existing notifications and never sends private content", () => {
  const notifications = read("lib/server/notifications.ts");
  const push = read("lib/server/web-push.ts");
  assert.match(notifications, /notification_deliveries\?on_conflict=notification_id,channel/);
  assert.match(push, /push_device_deliveries\?on_conflict=notification_id,subscription_id/);
  assert.match(push, /A message is waiting in your BidScope workspace/);
  assert.match(push, /status === 404 \|\| status === 410/);
  assert.doesNotMatch(push, /body: notice\.message/);
});

test("subscription endpoint is authenticated, validates provider URL, and returns redacted devices", () => {
  const route = read("app/api/push/subscriptions/route.ts");
  assert.match(route, /requireUser\(request\)/);
  assert.match(route, /allowedPushEndpoint/);
  assert.match(route, /createHash\("sha256"\)/);
  assert.match(route, /existing\[0\]\.user_id !== user\.id/);
});
