import assert from "node:assert/strict";
import test from "node:test";
import { eligibility, normalize, opportunityStatus } from "../../lib/server/procurement/normalization.ts";
import { AfricanUnionAdapter, EcowasAdapter } from "../../lib/server/procurement/structured-adapters.ts";
import { deduplicationKeys } from "../../lib/server/procurement/deduplication.ts";
import { parseDate } from "../../lib/server/procurement/safety.ts";

test("status engine separates upcoming, closing soon, open and closed", () => {
  const now = new Date("2026-09-14T00:00:00Z");
  assert.equal(opportunityStatus({ stage: "General Procurement Notice" }, now), "UPCOMING");
  assert.equal(opportunityStatus({ deadlineAt: "2026-09-16T00:00:00Z" }, now), "CLOSING_SOON");
  assert.equal(opportunityStatus({ deadlineAt: "2026-10-16T00:00:00Z" }, now), "OPEN");
  assert.equal(opportunityStatus({ deadlineAt: "2026-09-01T00:00:00Z" }, now), "CLOSED");
  assert.equal(opportunityStatus({}, now), "UNKNOWN");
});

test("Ghana day-first deadlines are parsed without US date reversal", () => {
  assert.equal(parseDate("02/10/2026 10:00:00"), "2026-10-02T10:00:00.000Z");
  assert.equal(parseDate("30/09/2026 13:30:00"), "2026-09-30T13:30:00.000Z");
  assert.equal(parseDate("2026-08-31+02:00"), "2026-08-31T00:00:00.000Z");
});

test("eligibility never invents international access", () => {
  assert.equal(eligibility("International competitive bidding; open to all eligible countries", "GB").status, "INTERNATIONAL_ELIGIBLE");
  assert.equal(eligibility("Only prequalified firms may submit", "ZZ").status, "RESTRICTED");
  assert.equal(eligibility(null, "GB").status, "UNCLEAR");
});

test("canonical records keep official provenance and deterministic duplicate keys", () => {
  const input = { title: "Supply of equipment", buyer_name: "Example Authority", country: "Ghana", country_code: "GH", deadline_at: "2026-10-16T00:00:00Z", source_name: "GHANEPS", source_type: "STRUCTURED_WEB", official_source_url: "https://example.gov.gh/tender/1", external_reference: "GH-001" } as const;
  const first = normalize(input); const second = normalize(input);
  assert.deepEqual(deduplicationKeys(first), deduplicationKeys(second));
  assert.equal(first.official_source_url, input.official_source_url);
});

test("regional parsers reject programme noise and preserve official links", () => {
  const ecowas = new EcowasAdapter();
  const html = `<ul class="nwp-light-list"><li><a href="https://www.ecowas.int/nwp_events/supply-equipment/"><small>Closing date: 30 Sep, 2026</small><h6>Supply of ICT equipment</h6></a></li><li><a href="https://www.ecowas.int/nwp_events/annual-plan/"><h6>Annual Procurement Plan</h6></a></li></ul>`;
  const rows = ecowas.parse(html); assert.equal(rows.length, 1); assert.match(String(rows[0].url), /^https:\/\/www\.ecowas\.int/);
  const au = new AfricanUnionAdapter(); const auRows = au.parse(`<table><tr><td><time datetime="2026-09-01T00:00:00Z">2026-09-01</time> - <time datetime="2026-09-30T12:00:00Z">2026-09-30</time></td><td class="views-field-title"><a href="/en/bids/20260901/supply-contract">Supply contract</a></td><td>ET-AUC-123</td></tr></table>`); assert.equal(auRows.length, 1); assert.equal(auRows[0].deadline, "2026-09-30T12:00:00Z");
});
