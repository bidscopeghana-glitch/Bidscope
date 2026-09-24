import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(path:string)=>readFileSync(new URL(`../../${path}`,import.meta.url),"utf8");

test("country navigation reuses Discover country filtering and shows live counts",()=>{
  const navigation=read("components/customer/country-navigation.tsx"),customerApi=read("app/api/customer/route.ts"),opportunities=read("components/customer/opportunities.tsx");
  assert.match(navigation,/resource=countries/);
  assert.match(navigation,/customer\/discover\?country=/);
  assert.match(navigation,/item\.count/);
  assert.match(customerApi,/resource==="countries"/);
  assert.match(customerApi,/status:"in\.\(OPEN,CLOSING_SOON\)"/);
  assert.match(customerApi,/DEU:"Germany"/);
  assert.match(customerApi,/new Set\(raw\.split\(","\)/);
  assert.match(opportunities,/countryName\?`\$\{countryName\} opportunities`/);
});

test("feedback is authenticated, rate limited and reviewable only by the super administrator",()=>{
  const migration=read("supabase/migrations/20260924234500_platform_feedback.sql"),userApi=read("app/api/feedback/route.ts"),adminApi=read("app/api/admin/feedback/route.ts"),adminShell=read("app/admin/command-centre/admin-shell.tsx"),navigation=read("components/customer/navigation.ts"),customerRoute=read("app/customer/[[...section]]/page.tsx");
  assert.match(migration,/enable row level security/);
  assert.match(migration,/revoke all on public\.platform_feedback from anon, authenticated/);
  assert.match(userApi,/requireUser\(request\)/);
  assert.match(userApi,/recent>=5/);
  assert.match(adminApi,/requireSuperAdmin\(request\)/g);
  assert.match(adminApi,/version=eq\.\$\{input\.version\}/);
  assert.match(adminShell,/Customer feedback/);
  assert.match(navigation,/\/customer\/feedback/);
  assert.match(customerRoute,/"feedback"/);
});
