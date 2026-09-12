import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("live and award data endpoints enforce member authentication", async () => {
  const opportunities = await readFile(new URL("../../app/api/opportunities/route.ts", import.meta.url), "utf8");
  const awards = await readFile(new URL("../../app/api/awards/route.ts", import.meta.url), "utf8");
  assert.match(opportunities, /view"\) === "live"\) await requireUser\(request\)/);
  assert.match(awards, /await requireUser\(request\)/);
});

test("member-only pages use the shared access gate", async () => {
  const live = await readFile(new URL("../../app/live-opportunities/page.tsx", import.meta.url), "utf8");
  const awards = await readFile(new URL("../../app/awarded-opportunities/page.tsx", import.meta.url), "utf8");
  assert.match(live, /<MemberAccess/);
  assert.match(awards, /<MemberAccess/);
});
