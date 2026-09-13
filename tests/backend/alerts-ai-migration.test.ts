import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const sql=readFileSync(new URL("../../supabase/migrations/20260913120000_alerts_ai_procurement_assistant.sql",import.meta.url),"utf8");
test("alerts and AI migration stores server-side state",()=>{for(const table of ["alert_preferences","notifications","notification_deliveries","watched_entities","procurement_events","opportunity_revisions","supplier_documents","document_chunks","ai_threads","ai_messages","ai_usage"])assert.match(sql,new RegExp(`create table if not exists public\\.${table}`));});
test("private user and AI tables have row-level security",()=>{for(const table of ["alert_preferences","notifications","watched_entities","supplier_documents","ai_threads","ai_messages","ai_usage"])assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`));});
test("duplicate notifications and deliveries are prevented in the database",()=>{assert.match(sql,/unique \(user_id, dedupe_key\)/);assert.match(sql,/unique \(notification_id, channel\)/);});
