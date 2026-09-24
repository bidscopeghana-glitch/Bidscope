import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("notification popup renders a bounded preview while preserving the full centre",()=>{
  const bell=readFileSync("components/procurement/notification-bell.tsx","utf8");
  const route=readFileSync("app/api/notifications/route.ts","utf8");
  assert.match(bell,/notifications\?type=\$\{filter\}&limit=20/);
  assert.match(bell,/Latest 20 alerts/);
  assert.match(bell,/href="\/notifications"/);
  assert.match(route,/Math\.min\(100,Math\.max\(1/);
  assert.match(route,/limit:String\(limit\)/);
});
