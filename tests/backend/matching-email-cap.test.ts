import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

test("a shared atomic quota permits no more than three matching-tender emails per recipient per UTC day", () => {
  const migration = read("supabase/migrations/20260923090000_matching_tender_email_daily_cap.sql");
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /v_count >= 3/);
  assert.match(migration, /unique \(recipient, claimed_on, slot\)/);
  assert.match(migration, /time zone 'UTC'/);
  assert.match(migration, /revoke all on function .* from public, anon, authenticated/);
});

test("both tender email senders reserve quota immediately before provider delivery", () => {
  const unified = read("lib/server/notifications.ts");
  const legacy = read("app/api/internal/alerts/run/route.ts");
  assert.match(unified, /type === "matching_tender" \|\| delivery\.notification\.type === "opportunity_match"/);
  assert.match(unified, /claimMatchingTenderEmail\(recipient/);
  assert.match(legacy, /claimMatchingTenderEmail\(delivery\.recipient/);
  assert.match(legacy, /status: "suppressed"/);
});
