import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../../supabase/migrations/20260912143000_create_bidscope_backend.sql", import.meta.url);

test("backend migration contains every core domain table and enables RLS", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  const tables = [
    "profiles", "organizations", "organization_members", "procuring_entities", "opportunities",
    "opportunity_documents", "awards", "award_suppliers", "saved_opportunities", "alert_rules",
    "alert_deliveries", "subscriptions", "ingestion_sources", "ingestion_runs", "webhook_events", "audit_log",
  ];
  for (const table of tables) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}\\b`, "i"));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
});

