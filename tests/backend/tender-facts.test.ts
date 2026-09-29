import assert from "node:assert/strict";
import test from "node:test";
import { displayableSourceFact, formatSourceFact, formatTenderFact } from "../../lib/tender-facts.ts";

test("document evidence renders as a readable checklist item, not JSON", () => {
  assert.equal(formatTenderFact({ name: "Bid security", evidence: "Required in the notice" }), "Bid security — Required in the notice");
  assert.equal(formatTenderFact({ name: "Tax clearance" }), "Tax clearance");
});

test("invalid legacy notice date is hidden until a verified date is available", () => {
  assert.equal(displayableSourceFact("Contract Notice Date", "&copy;2026 European Dynamics"), false);
  assert.equal(displayableSourceFact("Contract Notice Date", "29/09/2026"), true);
});

test("legacy notice date displays without copied footer text", () => {
  assert.equal(formatSourceFact("Contract Notice Date", "15/09/2026 15:16:42 Last Update: 22 September 2026 &copy;2026 European Dynamics"), "15/09/2026 15:16:42");
});

test("polluted legacy source fields do not masquerade as evaluation criteria", () => {
  assert.equal(displayableSourceFact("Evaluation Criteria", "Lowest Evaluated Responsive Tenderer (LERT) No Preference No Yes 73161604 Participation Fee Required 500"), false);
  assert.equal(displayableSourceFact("Evaluation Criteria", "Price 70%; technical quality 30%"), true);
  assert.equal(formatSourceFact("Procurement Method", "National Competitive Tendering Includes eAuction: No"), "National Competitive Tendering");
});
