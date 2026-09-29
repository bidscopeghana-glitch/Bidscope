import assert from "node:assert/strict";
import test from "node:test";
import { displayableSourceFact, formatTenderFact } from "../../lib/tender-facts.ts";

test("document evidence renders as a readable checklist item, not JSON", () => {
  assert.equal(formatTenderFact({ name: "Bid security", evidence: "Required in the notice" }), "Bid security — Required in the notice");
  assert.equal(formatTenderFact({ name: "Tax clearance" }), "Tax clearance");
});

test("invalid legacy notice date is hidden until a verified date is available", () => {
  assert.equal(displayableSourceFact("Contract Notice Date", "&copy;2026 European Dynamics"), false);
  assert.equal(displayableSourceFact("Contract Notice Date", "29/09/2026"), true);
});
