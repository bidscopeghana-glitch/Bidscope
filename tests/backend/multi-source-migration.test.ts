import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl=new URL("../../supabase/migrations/20260912160000_multi_source_procurement_intelligence.sql",import.meta.url);
test("multi-source migration creates canonical, traceability, sync, tracking and analytics tables",async()=>{const sql=await readFile(migrationUrl,"utf8");for(const table of ["procurement_sources","procurement_opportunities","opportunity_sources","source_sync_runs","user_bid_tracking","submission_clicks","analytics_events"]){assert.match(sql,new RegExp(`create table if not exists public\\.${table}\\b`,"i"));assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`,"i"));}for(const source of ["GHANEPS","MRH e-Bids","Bank of Ghana","UNGM","African Development Bank","World Bank"])assert.match(sql,new RegExp(`'${source.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}'`));assert.match(sql,/insert into public\.procurement_opportunities/i);});
