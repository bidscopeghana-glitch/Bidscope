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
  const example=read(".env.example");
  assert.match(example,/GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL=/);
  assert.match(example,/GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY=/);
});

test("SEO sitemap inventory paginates past the Supabase one-thousand-row response cap",()=>{
  const source=read("lib/server/seo-opportunities.ts");
  assert.match(source,/offset:String\(offset\)/);
  assert.match(source,/Math\.min\(1000,requested-offset\)/);
  assert.match(source,/published_at\.desc,slug\.asc/);
});

test("Phase 2 operations migration covers demand, referrals, outreach, reporting and RLS",()=>{
  const sql=read("supabase/migrations/20260920224000_seo_growth_operations.sql");
  for(const table of["seo_internal_searches","seo_search_synonyms","seo_referral_metrics","seo_search_dimensions","seo_outreach_targets","seo_utm_links","seo_reports","seo_technical_checks","seo_social_drafts"]){
    assert.match(sql,new RegExp(`create table if not exists public\\.${table}\\b`,"i"),table);
    assert.match(sql,new RegExp(`'${table}'`,"i"),`${table} RLS loop`);
  }
  for(const event of["buyer_signup","supplier_signup","tender_watch","subscription_completed","bid_started","bid_submitted","tender_post_completed"])assert.match(sql,new RegExp(`'${event}'`),event);
});

test("Phase 2 admin workspaces are protected by the growth admin layout",()=>{
  assert.match(read("app/admin/growth/seo/operations/page.tsx"),/SeoOperationsWorkspace/);
  assert.match(read("app/admin/growth/seo/content/page.tsx"),/SeoContentWorkspace/);
  assert.match(read("app/admin/growth/layout.tsx"),/robots:\{index:false/);
  assert.match(read("app/api/admin/seo/route.ts"),/requireSuperAdmin/);
});

test("editorial publishing is review first and only exposes published indexable content",()=>{
  const editor=read("components/admin/seo-content-workspace.tsx"),content=read("lib/server/seo-content.ts");
  assert.match(editor,/Nothing auto-publishes/);
  assert.match(editor,/quality warnings/);
  assert.match(content,/status=eq\.published&indexable=eq\.true/);
  assert.match(read("app/sitemap.ts"),/listPublishedSeoContent/);
});

test("scheduled SEO maintenance is protected and registered",()=>{
  assert.match(read("app/api/internal/seo/maintenance/route.ts"),/requireCronOrInternalSecret/);
  assert.match(read("lib/server/seo-maintenance.ts"),/robots_accessible/);
  assert.match(read("lib/server/seo-maintenance.ts"),/syncSearchConsole/);
  assert.match(read("app/api/internal/notifications/process/route.ts"),/runSeoMaintenance/);
  assert.match(read("vercel.json"),/\/api\/internal\/notifications\/process/);
});

test("growth centre exposes truthful Search Console status and manual synchronization",()=>{
  const dashboard=read("components/admin/seo-growth-dashboard.tsx");
  assert.match(dashboard,/Sync Search Console now/);
  assert.match(dashboard,/search_console_last_synced_at/);
  assert.match(dashboard,/error_summary/);
  assert.match(dashboard,/\/api\/admin\/seo\/sync/);
});

test("organic attribution supports required acquisition and procurement events",()=>{
  const route=read("app/api/analytics/seo/route.ts"),client=read("components/seo/seo-attribution.tsx");
  for(const event of["buyer_signup","supplier_signup","tender_watch","tender_alert_created","subscription_completed","bid_started","bid_submitted","tender_post_started","tender_post_completed"])assert.match(route,new RegExp(`\\"${event}\\"`));
  assert.match(client,/trackBidScopeInternalSearch/);
  assert.match(client,/medium:\"organic\"/);
});
