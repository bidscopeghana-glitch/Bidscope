import assert from "node:assert/strict";
import test from "node:test";
import { countGhanaOpportunities } from "../../lib/server/procurement/metrics.ts";
import type { NormalizedOpportunity } from "../../lib/server/procurement/types.ts";

test("Ghana sync metric excludes international and unverified-location notices", () => {
  const records = [
    { country_code: "GH" },
    { country_code: "gh" },
    { country_code: "US" },
    { country_code: "ZZ" },
  ] as NormalizedOpportunity[];
  assert.equal(countGhanaOpportunities(records), 2);
});
