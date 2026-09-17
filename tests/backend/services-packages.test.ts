import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {SERVICE_CATALOG,SERVICE_CODES} from "../../lib/service-catalog.ts";
import {CURRENT_PLAN_CODES,LAUNCH_PRICES} from "../../lib/package-offer.ts";
test("launch prices use distinct codes and ten-month annual pricing",()=>{
 assert.equal(CURRENT_PLAN_CODES.length,6);
 for(const plan of Object.values(LAUNCH_PRICES))assert.equal(plan.annual,plan.monthly*10);
 assert.deepEqual(Object.values(LAUNCH_PRICES).map(p=>p.monthly),[150,300,600]);
 for(const code of CURRENT_PLAN_CODES)assert.match(code,/_launch_/);
});
test("custom service catalogue has bounded selectable deliverables",()=>{
 assert.deepEqual(SERVICE_CATALOG.map(s=>s.code),[...SERVICE_CODES]);
 for(const service of SERVICE_CATALOG)assert.equal(service.deliverables.length,3);
});
test("service mutations enforce ownership, quote version and expiry",()=>{
 const route=readFileSync("app/api/services/route.ts","utf8");
 assert.match(route,/await requireUser\(request\)/);
 assert.match(route,/user_id:`eq\.\$\{user.id\}`/);
 assert.match(route,/version:`eq\.\$\{input.version\}`/);
 assert.match(route,/quote_expires_at/);
 assert.match(route,/!input.agreed/);
 const admin=readFileSync("app/api/admin/services/route.ts","utf8");
 assert.match(admin,/await requireSuperAdmin\(request\)/);
 assert.match(admin,/eq.ACCEPTED/);
});
test("service migration keeps legacy plans intact and protects request data",()=>{
 const sql=readFileSync("supabase/migrations/20260917190000_services_and_launch_packages.sql","utf8");
 assert.doesNotMatch(sql,/update public\.(subscriptions|billing_plans)/i);
 assert.match(sql,/on conflict\(code\) do nothing/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/from anon,authenticated,public/);
 assert.match(sql,/service_request_history/);
});
