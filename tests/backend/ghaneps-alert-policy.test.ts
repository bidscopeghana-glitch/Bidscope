import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { alertableSearchResults, isGhanepsSource } from "../../lib/server/ghaneps-alert-policy.ts";

test("GHANEPS variants are excluded without excluding unrelated Ghana sources", () => {
  for (const name of ["GHANEPS", "GHANEPS / Public Procurement Authority Ghana", "PPA GHANEPS feed", "ghaneps"]) {
    assert.equal(isGhanepsSource(name), true);
  }
  for (const name of ["World Bank", "Ministry of Finance", "Ghana Electronic Procurement System", null]) {
    assert.equal(isGhanepsSource(name), false);
  }
});

test("saved-search alert content never includes GHANEPS results", () => {
  const results = [
    { title: "GHANEPS tender", source_name: "GHANEPS" },
    { title: "World Bank tender", source_name: "World Bank" },
  ];
  assert.deepEqual(alertableSearchResults(results), [results[1]]);
  assert.deepEqual(alertableSearchResults([results[0]]), []);
});

test("every automated tender notification path applies the GHANEPS guard", () => {
  const processor = readFileSync("app/api/internal/notifications/process/route.ts", "utf8");
  const scheduled = readFileSync("lib/server/scheduled-sms-alerts.ts", "utf8");
  const search = readFileSync("lib/server/customer-search-alerts.ts", "utf8");
  const engagement = readFileSync("lib/server/daily-engagement-alerts.ts", "utf8");
  const delivery = readFileSync("lib/server/notifications.ts", "utf8");
  assert.match(processor, /!opportunity\|\|isGhanepsSource\(opportunity\.source_name\)/);
  assert.match(processor, /isGhanepsSource\(row\.opportunity\.source_name\)/);
  assert.match(scheduled, /isGhanepsSource\(opportunity\.source_name\)/);
  assert.match(search, /alertableSearchResults\(result\.data\)/);
  assert.match(engagement, /source_name=not\.ilike\.\*GHANEPS\*/);
  assert.match(delivery, /isGhanepsSource\(opportunities\[0\]\?\.source_name\)/);
  assert.match(delivery, /GHANEPS notifications are disabled/);
});
