import assert from "node:assert/strict";
import test from "node:test";
import { matchesAlert, type AlertOpportunityRecord, type AlertRuleRecord } from "../../lib/server/alerts.ts";

const opportunity: AlertOpportunityRecord = {
  id: "opportunity-1", slug: "solar-streetlights", title: "Supply and installation of solar streetlights",
  summary: "Works for a municipal assembly", description: "Installation across Tamale",
  category: "works", sector: "energy, construction", region: "Northern",
  buyer_normalized_id: "buyer-1", estimated_value: 500000, deadline_at: "2026-10-01T12:00:00+00:00",
  official_source_url: "https://example.gov.gh/tenders/solar-streetlights",
};

const rule: AlertRuleRecord = {
  id: "rule-1", keywords: ["solar"], excluded_keywords: [], categories: ["works"], sectors: ["energy"],
  regions: ["Northern"], buyer_ids: [], minimum_value: 100000, maximum_value: 1000000,
  deadline_days_min: 1, deadline_days_max: 60, email_recipients: ["team@example.com"],
};

test("matches a relevant opportunity across the configured filters", () => {
  assert.equal(matchesAlert(rule, opportunity, new Date("2026-09-12T12:00:00Z")), true);
});

test("rejects excluded keywords and expired deadline windows", () => {
  assert.equal(matchesAlert({ ...rule, excluded_keywords: ["tamale"] }, opportunity, new Date("2026-09-12T12:00:00Z")), false);
  assert.equal(matchesAlert(rule, opportunity, new Date("2026-11-01T12:00:00Z")), false);
});

test("rejects values outside the configured range", () => {
  assert.equal(matchesAlert({ ...rule, minimum_value: 600000 }, opportunity, new Date("2026-09-12T12:00:00Z")), false);
});
