import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260924190042_harden_function_privileges_and_indexes.sql",
  "utf8",
);

test("privileged functions use a pinned search path and least-privilege execution", () => {
  for (const signature of [
    "handle_new_user\\(\\)",
    "create_organization_with_owner\\(text, text, text\\[\\], text\\)",
    "is_organization_member\\(uuid\\)",
    "is_organization_admin\\(uuid\\)",
    "is_meeting_participant\\(uuid\\)",
    "audit_source_rights\\(\\)",
  ]) {
    assert.match(migration, new RegExp(`alter function public\\.${signature} set search_path = ''`));
  }
  assert.match(migration, /revoke execute on function public\.handle_new_user\(\) from public, anon, authenticated/);
  assert.match(migration, /revoke execute on function public\.audit_source_rights\(\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.is_organization_member\(uuid\) to authenticated, service_role/);
});

test("duplicate opportunity deadline index is removed without touching workload-dependent indexes", () => {
  assert.match(migration, /drop index if exists public\.procurement_opportunities_deadline_status_idx/);
  assert.doesNotMatch(migration, /drop index[^;]*procurement_opportunities_status_deadline_idx/);
});

test("runtime admin identity comes from server configuration", () => {
  const auth = readFileSync("lib/server/auth.ts", "utf8");
  const tenderSubmission = readFileSync("app/api/tender-submissions/[id]/route.ts", "utf8");
  const customerShell = readFileSync("components/customer/shell.tsx", "utf8");
  const customerDetail = readFileSync("components/customer/detail.tsx", "utf8");
  assert.match(auth, /process\.env\.BIDSCOPE_ADMIN_EMAIL/);
  assert.doesNotMatch(auth, /basintaleuk@gmail\.com/);
  assert.match(tenderSubmission, /isBidscopeSuperAdmin\(user\)/);
  assert.doesNotMatch(tenderSubmission, /basintaleuk@gmail\.com/);
  assert.match(customerShell, /is_bidscope_admin/);
  assert.match(customerDetail, /profile\?\.is_bidscope_admin/);
  assert.doesNotMatch(customerShell + customerDetail, /basintaleuk@gmail\.com/);
});
