import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(path:string)=>readFileSync(path,"utf8");

test("new members receive configurable daily opportunity and return reminders",()=>{
  const migration=read("supabase/migrations/20260920150000_daily_subscription_alerts.sql");
  assert.match(migration,/workspace_reminder'\),'daily'/);
  assert.match(migration,/on conflict\(user_id,alert_type\) do nothing/);
  assert.doesNotMatch(migration,/on conflict\(user_id,alert_type\) do update/);
});

test("specific tender alerts are limited and matched by paid package",()=>{
  const migration=read("supabase/migrations/20260920150000_daily_subscription_alerts.sql");
  const processor=read("app/api/internal/notifications/process/route.ts");
  for(const [tier,limit,threshold] of [["pro",3,75],["premium",8,60],["platinum",20,50]] as const){
    assert.match(migration,new RegExp(`daily_tender_alerts\\\":${limit}.*alert_match_threshold\\\":${threshold}`));
    assert.match(migration,new RegExp(`code like '${tier}%`));
  }
  assert.match(processor,/entitlement\.features\.smart_alerts/);
  assert.match(processor,/match\.percentage<threshold/);
  assert.match(processor,/created_at=gte\.\$\{dayStart\}/);
});

test("daily reminders are deduplicated and email alerts provide unsubscribe controls",()=>{
  const daily=read("lib/server/daily-engagement-alerts.ts");
  const notifications=read("lib/server/notifications.ts");
  const unsubscribe=read("lib/server/outreach/unsubscribe.ts");
  assert.match(daily,/daily-engagement/);
  assert.match(daily,/frequencyOverride:"daily"/);
  assert.match(notifications,/List-Unsubscribe/);
  assert.match(unsubscribe,/alerts_unsubscribe/);
  assert.match(unsubscribe,/email_enabled:false/);
});

test("subscription resolution uses the purchased billing plan code",()=>{
  const entitlements=read("lib/server/entitlements.ts");
  assert.match(entitlements,/metadata\?\.billing_plan_code\|\|subscription\?\.plan_code/);
  assert.match(entitlements,/momo_30\|momo_365/);
});
