import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {answerNeedsReview} from "../../lib/response-library.ts";
const sql=readFileSync(new URL("../../supabase/migrations/20260925223502_response_library.sql",import.meta.url),"utf8");
test("approved answers remain current through their review date",()=>{
 const now=new Date("2026-09-25T23:59:59Z");
 assert.equal(answerNeedsReview("2026-09-25",now),false);
 assert.equal(answerNeedsReview("2026-09-24",now),true);
 assert.equal(answerNeedsReview(null,now),false);
});
test("response library migration denies client writes and exposes organisation-scoped reads",()=>{
 for(const table of ["response_library","response_library_versions"]){
  assert.ok(sql.includes(`alter table public.${table} enable row level security`));
 }
 assert.match(sql,/revoke all on public.response_library, public.response_library_versions from anon,authenticated/);
 assert.match(sql,/using\(public.is_organization_member\(organization_id\)\)/);
 assert.match(sql,/revoke all on function public.mutate_response_library.*from public,anon,authenticated/);
});
test("approvals are atomic, role checked, immutable and revision guarded",()=>{
 assert.match(sql,/organization_id=p_organization for update/);
 assert.match(sql,/item.revision<>p_revision/);
 assert.match(sql,/member_role not in \('owner','admin'\)/);
 assert.match(sql,/before update or delete on public.response_library_versions/);
 assert.match(sql,/insert into public.procurement_audit_logs/);
 assert.doesNotMatch(sql,/security definer/i);
});
