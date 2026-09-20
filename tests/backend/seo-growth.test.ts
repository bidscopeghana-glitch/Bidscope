import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const read=(path:string)=>readFileSync(join(process.cwd(),path),"utf8");

test("SEO growth migration protects operational and attribution data",()=>{
  const sql=read("supabase/migrations/20260920210000_seo_growth_engine.sql");
  for(const table of["seo_settings","seo_keywords","seo_content_items","seo_page_metrics","seo_traffic_sessions","seo_conversion_events","seo_backlinks","seo_experiments","seo_alerts","seo_sync_runs"]){
    assert.match(sql,new RegExp(`create table if not exists public\\.${table}\\b`,"i"),table);
    assert.match(sql,new RegExp(`'${table}'`,"i"),table);
  }
  assert.match(sql,/alter table public\.%I enable row level security/i);
  assert.match(sql,/is_super_admin/);
});

test("SEO admin endpoints enforce builder administrator access",()=>{
  assert.match(read("app/api/admin/seo/route.ts"),/requireSuperAdmin/);
  assert.match(read("app/api/admin/seo/sync/route.ts"),/requireSuperAdmin/);
  assert.match(read("app/admin/growth/layout.tsx"),/index:false/);
});

test("growth centre includes truthful integration states and workflows",()=>{
  const page=read("components/admin/seo-growth-dashboard.tsx");
  for(const label of["Keywords","Content","Technical health","Links","Settings","READY — REQUIRES OWNER ACTION","Human review required"])assert.match(page,new RegExp(label));
});

test("attribution is consent gated and stores pseudonymous identifiers",()=>{
  const client=read("components/seo/seo-attribution.tsx"),route=read("app/api/analytics/seo/route.ts");
  assert.match(client,/cookieAnalytics!=="granted"/);
  assert.match(route,/createHash\("sha256"\)/);
  assert.doesNotMatch(route,/visitor_id_hash:input\.visitorId/);
});

test("Search Console integration uses read-only scope and server credentials",()=>{
  const source=read("lib/server/search-console.ts");
  assert.match(source,/webmasters\.readonly/);
  assert.match(source,/GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY/);
  assert.match(source,/searchAnalytics\/query/);
  assert.doesNotMatch(source,/NEXT_PUBLIC_GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY/);
});
