import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../../app/api/procurement/route.ts", import.meta.url), "utf8");

test("lot comparison and its history require tender-manager access and opened bids", () => {
  const model = route.slice(route.indexOf('if (input.action === "model_lot_awards")'), route.indexOf('if (input.action === "submit_verification")'));
  const history = route.slice(route.indexOf('if (resource === "lot_scenario_history")'), route.indexOf('if (resource === "my_bids")'));
  for (const section of [model, history]) {
    assert.match(section, /requireTenderManager\(user, tenderId\)|requireTenderManager\(user, input\.tenderId\)/);
    assert.match(section, /bidsAreOpen\(tender\)/);
  }
  assert.match(model, /action: "lot_award_scenarios_modelled"/);
  assert.match(model, /allocations: scenarios\.map|allocations: scenario\.allocations\.map/);
  assert.doesNotMatch(model, /procurement_awards/);
});
