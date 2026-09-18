import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("live and award data endpoints enforce subscription access", async () => {
  const opportunities = await readFile(new URL("../../app/api/opportunities/route.ts", import.meta.url), "utf8");
  const awards = await readFile(new URL("../../app/api/awards/route.ts", import.meta.url), "utf8");
  assert.match(opportunities, /canViewTenderSource\(request\)/);
  assert.match(opportunities, /view"\) === "live" && !authenticated/);
  assert.match(awards, /canViewTenderSource\(request\)/);
  assert.match(awards, /subscription_required/);
});

test("legacy member pages redirect to the authenticated customer shell", async () => {
  const live = await readFile(new URL("../../app/live-opportunities/page.tsx", import.meta.url), "utf8");
  const awards = await readFile(new URL("../../app/awarded-opportunities/page.tsx", import.meta.url), "utf8");
  assert.match(live, /redirect\("\/customer\/discover"\)/);
  assert.match(awards, /redirect\("\/customer\/awards"\)/);
  const shell = await readFile(new URL("../../components/customer/shell.tsx", import.meta.url), "utf8");
  assert.match(shell, /if\(!session\|\|expired\)/);
  const customer = await readFile(new URL("../../app/api/customer/route.ts", import.meta.url), "utf8");
  assert.match(customer, /await requireUser\(request\)/);
});
