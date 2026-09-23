import { z } from "zod";
import { apiErrorResponse, ApiError } from "@/lib/server/api-error";
import { requireSuperAdmin } from "@/lib/server/auth";
import { reviewDiscovery } from "@/lib/server/discovery/review";
import { startDueCrawl, pollCrawlJobs } from "@/lib/server/discovery/service";
import { supabaseRest, encodeFilter } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["approve", "reject", "mark_unique", "mark_duplicate", "merge", "edit", "reextract"]), id: z.string().uuid(), matchId: z.string().uuid().optional(), extracted: z.record(z.unknown()).optional() }),
  z.object({ action: z.literal("settings"), enabled: z.boolean().optional(), autoPublish: z.boolean().optional(), maxCrawlsPerDay: z.number().int().min(0).max(1000).optional(), maxRenderedPagesPerDay: z.number().int().min(0).max(10000).optional(), maxExtractionsPerDay: z.number().int().min(0).max(100000).optional() }),
  z.object({ action: z.literal("source"), id: z.string().uuid(), enabled: z.boolean().optional(), robotsAllowed: z.boolean().optional(), termsReviewed: z.boolean().optional(), startUrl: z.string().url().optional(), maxPages: z.number().int().min(1).max(100).optional(), depth: z.number().int().min(0).max(3).optional(), intervalHours: z.number().int().min(1).max(720).optional(), requiresRendering: z.boolean().optional() }),
  z.object({ action: z.literal("run"), sourceId: z.string().uuid().optional() }),
  z.object({ action: z.literal("poll") }),
]);

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request);
    const status = new URL(request.url).searchParams.get("status");
    const filter = status && /^(needs_review|published|rejected|expired|error)$/.test(status) ? `&processing_status=eq.${status}` : "";
    const [{ data: discoveries }, { data: sources }, { data: jobs }, { data: settings }] = await Promise.all([
      supabaseRest(`opportunity_discoveries?select=id,source_id,source_url,canonical_url,source_reference,raw_title,raw_text,extracted_data,first_seen_at,last_checked_at,processing_status,duplicate_status,matched_tender_id,confidence_score,duplicate_score,error_message&order=created_at.desc&limit=100${filter}`),
      supabaseRest("procurement_sources?select=id,name,base_url,country_code,trust_level,discovery_enabled,crawl_start_url,crawl_max_pages,crawl_depth,crawl_interval_hours,crawl_requires_rendering,crawl_robots_allowed,crawl_terms_reviewed,crawl_last_at,crawl_last_success_at,crawl_last_failure_at,crawl_consecutive_failures,crawl_next_at&order=name.asc"),
      supabaseRest("discovery_crawl_jobs?select=*&order=started_at.desc&limit=30"),
      supabaseRest("discovery_settings?select=*&singleton_key=eq.default&limit=1"),
    ]);
    return Response.json({ data: { discoveries, sources, jobs, settings: (settings as Array<unknown>)[0] || null } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireSuperAdmin(request);
    const input = actionSchema.parse(await request.json());
    if (input.action === "run") return Response.json({ data: await startDueCrawl(input.sourceId) });
    if (input.action === "poll") return Response.json({ data: await pollCrawlJobs() });
    if (input.action === "settings") {
      const body = { ...(input.enabled !== undefined ? { enabled: input.enabled } : {}), ...(input.autoPublish !== undefined ? { auto_publish: input.autoPublish } : {}), ...(input.maxCrawlsPerDay !== undefined ? { max_crawls_per_day: input.maxCrawlsPerDay } : {}), ...(input.maxRenderedPagesPerDay !== undefined ? { max_rendered_pages_per_day: input.maxRenderedPagesPerDay } : {}), ...(input.maxExtractionsPerDay !== undefined ? { max_extractions_per_day: input.maxExtractionsPerDay } : {}), updated_at: new Date().toISOString() };
      await supabaseRest("discovery_settings?singleton_key=eq.default", { method: "PATCH", body: JSON.stringify(body) });
      await supabaseRest("audit_log", { method: "POST", body: JSON.stringify({ actor_user_id: user.id, action: "discovery.settings.updated", entity_type: "discovery_settings", entity_id: "default", metadata: { fields: Object.keys(body) } }) });
      return Response.json({ data: body });
    }
    if (input.action === "source") {
      const { data: sources } = await supabaseRest<Array<{ base_url: string }>>(`procurement_sources?select=base_url&id=eq.${encodeFilter(input.id)}&limit=1`);
      if (!sources[0]) throw new ApiError(404, "Source not found.");
      if (input.startUrl && (new URL(input.startUrl).protocol !== "https:" || new URL(input.startUrl).hostname !== new URL(sources[0].base_url).hostname)) throw new ApiError(400, "Crawl URL must use HTTPS on the source host.");
      const body = { ...(input.enabled !== undefined ? { discovery_enabled: input.enabled } : {}), ...(input.robotsAllowed !== undefined ? { crawl_robots_allowed: input.robotsAllowed } : {}), ...(input.termsReviewed !== undefined ? { crawl_terms_reviewed: input.termsReviewed } : {}), ...(input.startUrl ? { crawl_start_url: input.startUrl } : {}), ...(input.maxPages !== undefined ? { crawl_max_pages: input.maxPages } : {}), ...(input.depth !== undefined ? { crawl_depth: input.depth } : {}), ...(input.intervalHours !== undefined ? { crawl_interval_hours: input.intervalHours } : {}), ...(input.requiresRendering !== undefined ? { crawl_requires_rendering: input.requiresRendering } : {}) };
      await supabaseRest(`procurement_sources?id=eq.${encodeFilter(input.id)}`, { method: "PATCH", body: JSON.stringify(body) });
      await supabaseRest("audit_log", { method: "POST", body: JSON.stringify({ actor_user_id: user.id, action: "discovery.source.updated", entity_type: "procurement_source", entity_id: input.id, metadata: body }) });
      return Response.json({ data: body });
    }
    const result = await reviewDiscovery(input.id, input.action, user.id, { matchId: input.matchId, extracted: input.extracted });
    return Response.json({ data: result });
  } catch (error) { return apiErrorResponse(error); }
}
