import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("UNGM connector is unregistered and its historical imports are retired safely", async () => {
  const registry = await readFile(new URL("../../lib/server/procurement/registry.ts", import.meta.url), "utf8");
  const sql = await readFile(new URL("../../supabase/migrations/20261006120000_remove_ungm_source.sql", import.meta.url), "utf8");
  assert.doesNotMatch(registry, /UngmAdapter|\bungm\s*:/);
  assert.match(sql, /update public\.ai_threads[\s\S]*opportunity_id = null/i);
  assert.match(sql, /insert into public\.audit_log/i);
  assert.match(sql, /delete from public\.procurement_opportunities/i);
  assert.match(sql, /delete from public\.procurement_sources/i);
});
