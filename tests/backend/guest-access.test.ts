import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { customerReturnPath } from "../../lib/auth-return.ts";

test("authentication returns only to known local BidScope workspaces", () => {
  assert.equal(customerReturnPath("/customer/opportunity/road"),"/customer/opportunity/road");
  assert.equal(customerReturnPath("/procurement/team"),"/procurement/team");
  assert.equal(customerReturnPath("/admin/command-centre/supplier-verifications"),"/admin/command-centre/supplier-verifications");
  assert.equal(customerReturnPath("/services/requests"),"/services/requests");
  for (const invalid of ["https://evil.test","//evil.test","/customer-evil","/procurement\\evil","/admin/other",null,["/customer"]]) assert.equal(customerReturnPath(invalid),"/customer");
});

test("workspace routing preserves role-appropriate requested destinations",()=>{
  const source=readFileSync("app/api/auth/workspace/route.ts","utf8");
  assert.match(source,/requestedPath\.startsWith\("\/procurement"\)/);
  assert.match(source,/requestedPath\.startsWith\("\/customer"\)/);
  assert.match(source,/requestedPath\.startsWith\("\/admin\/command-centre"\)/);
});
test("guest API boundaries use the central entitlement gate before returning full records", () => {
  for (const path of ["app/api/opportunities/route.ts","app/api/opportunities/[slug]/route.ts"]) {
    const source=readFileSync(path,"utf8");
    assert.match(source,/await canViewTenderSource\(request\)/);
    assert.match(source,/guestOpportunityPreview/);
    assert.match(source,/private, no-store/);
    assert.match(source,/Vary: "Authorization"/);
  }
});
test("guest migration revokes both table and column permissions without changing member grants", () => {
  const sql=readFileSync("supabase/migrations/20260917180000_guest_tender_access.sql","utf8");
  assert.match(sql,/revoke select on table/);
  assert.match(sql,/revoke select \(%s\)/);
  assert.match(sql,/from anon, public/);
  assert.doesNotMatch(sql,/from authenticated/);
});
