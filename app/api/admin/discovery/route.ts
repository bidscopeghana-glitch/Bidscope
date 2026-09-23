import { z } from "zod";
import { apiErrorResponse, ApiError } from "@/lib/server/api-error";
import { requireSuperAdmin } from "@/lib/server/auth";
import { reviewDiscovery } from "@/lib/server/discovery/review";
import { startDueCrawl, pollCrawlJobs } from "@/lib/server/discovery/service";
import { canCrawl, canAutoPublish, reuseStatuses, validateRights, type SourceRights } from "@/lib/server/discovery/rights";
import { supabaseRest, encodeFilter } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["approve", "reject", "mark_unique", "mark_duplicate", "merge", "edit", "reextract"]), id: z.string().uuid(), matchId: z.string().uuid().optional(), extracted: z.record(z.unknown()).optional() }),
  z.object({ action: z.literal("settings"), enabled: z.boolean().optional(), autoPublish: z.boolean().optional(), maxCrawlsPerDay: z.number().int().min(0).max(1000).optional(), maxRenderedPagesPerDay: z.number().int().min(0).max(10000).optional(), maxExtractionsPerDay: z.number().int().min(0).max(100000).optional() }),
  z.object({ action: z.literal("source"), id: z.string().uuid(), enabled: z.boolean().optional(), robotsAllowed: z.boolean().optional(), termsReviewed: z.boolean().optional(), startUrl: z.string().url().optional(), maxPages: z.number().int().min(1).max(100).optional(), depth: z.number().int().min(0).max(3).optional(), intervalHours: z.number().int().min(1).max(720).optional(), requiresRendering: z.boolean().optional() }),
  z.object({ action: z.literal("rights"), id: z.string().uuid(), reuseStatus: z.enum(reuseStatuses), licenseName: z.string().max(300).nullable(), licenseUrl: z.string().url().max(2000).nullable(), permissionEvidence: z.string().max(4000).nullable(), permissionDate: z.string().date().nullable(), permissionExpiry: z.string().date().nullable(), permissionNotes: z.string().max(4000).nullable(), contentReuseAllowed: z.boolean(), commercialReuseAllowed: z.boolean(), documentReuseAllowed: z.boolean(), metadataReuseAllowed: z.boolean(), autoPublishEnabled: z.boolean() }),
  z.object({ action: z.literal("run"), sourceId: z.string().uuid().optional() }),
  z.object({ action: z.literal("poll") }),
]);

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request);
    const status = new URL(request.url).searchParams.get("status");
    const filter = status && /^(needs_review|published|rejected|expired|error)$/.test(status) ? `&processing_status=eq.${status}` : "";
    const [{ data: discoveries }, { data: sources }, { data: jobs }, { data: settings }, { data: rightsAudit }] = await Promise.all([
      supabaseRest(`opportunity_discoveries?select=id,source_id,source_url,canonical_url,source_reference,raw_title,raw_text,extracted_data,first_seen_at,last_checked_at,processing_status,duplicate_status,matched_tender_id,confidence_score,duplicate_score,error_message&order=created_at.desc&limit=100${filter}`),
      supabaseRest("procurement_sources?select=id,name,slug,base_url,country_code,trust_level,official_source,discovery_enabled,discovery_auto_publish_enabled,reuse_status,license_name,license_url,permission_evidence,permission_date,permission_expiry,permission_notes,content_reuse_allowed,commercial_reuse_allowed,document_reuse_allowed,metadata_reuse_allowed,last_rights_reviewed_at,crawl_start_url,crawl_max_pages,crawl_depth,crawl_interval_hours,crawl_requires_rendering,crawl_robots_allowed,crawl_terms_reviewed,crawl_last_at,crawl_last_success_at,crawl_last_failure_at,crawl_consecutive_failures,crawl_next_at&order=name.asc"),
      supabaseRest("discovery_crawl_jobs?select=*&order=started_at.desc&limit=30"),
      supabaseRest("discovery_settings?select=*&singleton_key=eq.default&limit=1"),
      supabaseRest("source_rights_audit?select=id,source_id,old_rights,new_rights,changed_at,actor_user_id&order=changed_at.desc&limit=30"),
    ]);
    return Response.json({ data: { discoveries, sources, jobs, rightsAudit, settings: (settings as Array<unknown>)[0] || null } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireSuperAdmin(request);
    const input = actionSchema.parse(await request.json());
    if (input.action === "run") return Response.json({ data: await startDueCrawl(input.sourceId) });
    if (input.action === "poll") return Response.json({ data: await pollCrawlJobs() });
    if (input.action === "settings") {
      if (input.autoPublish) {
        const { data: eligible } = await supabaseRest<Array<SourceRights>>("procurement_sources?select=*&discovery_auto_publish_enabled=eq.true&limit=1000");
        if (!eligible.some(source => canAutoPublish(source))) throw new ApiError(409, "Approve source rights and per-source auto publication before enabling global publication.");
      }
      const body = { ...(input.enabled !== undefined ? { enabled: input.enabled } : {}), ...(input.autoPublish !== undefined ? { auto_publish: input.autoPublish } : {}), ...(input.maxCrawlsPerDay !== undefined ? { max_crawls_per_day: input.maxCrawlsPerDay } : {}), ...(input.maxRenderedPagesPerDay !== undefined ? { max_rendered_pages_per_day: input.maxRenderedPagesPerDay } : {}), ...(input.maxExtractionsPerDay !== undefined ? { max_extractions_per_day: input.maxExtractionsPerDay } : {}), updated_at: new Date().toISOString() };
      await supabaseRest("discovery_settings?singleton_key=eq.default", { method: "PATCH", body: JSON.stringify(body) });
      await supabaseRest("audit_log", { method: "POST", body: JSON.stringify({ actor_user_id: user.id, action: "discovery.settings.updated", entity_type: "discovery_settings", entity_id: "default", metadata: { fields: Object.keys(body) } }) });
      return Response.json({ data: body });
    }
    if (input.action === "source") {
      const { data: sources } = await supabaseRest<Array<SourceRights & { base_url: string; slug: string }>>(`procurement_sources?select=*&id=eq.${encodeFilter(input.id)}&limit=1`);
      if (!sources[0]) throw new ApiError(404, "Source not found.");
      if (input.enabled && sources[0].slug === "ghana-ministry-finance") throw new ApiError(409, "Ministry of Finance is not approved for discovery yet.");
      if (input.startUrl && (new URL(input.startUrl).protocol !== "https:" || new URL(input.startUrl).hostname !== new URL(sources[0].base_url).hostname)) throw new ApiError(400, "Crawl URL must use HTTPS on the source host.");
      const body = { ...(input.enabled !== undefined ? { discovery_enabled: input.enabled } : {}), ...(input.robotsAllowed !== undefined ? { crawl_robots_allowed: input.robotsAllowed } : {}), ...(input.termsReviewed !== undefined ? { crawl_terms_reviewed: input.termsReviewed } : {}), ...(input.startUrl ? { crawl_start_url: input.startUrl } : {}), ...(input.maxPages !== undefined ? { crawl_max_pages: input.maxPages } : {}), ...(input.depth !== undefined ? { crawl_depth: input.depth } : {}), ...(input.intervalHours !== undefined ? { crawl_interval_hours: input.intervalHours } : {}), ...(input.requiresRendering !== undefined ? { crawl_requires_rendering: input.requiresRendering } : {}) };
      if (input.enabled && !canCrawl({ ...sources[0], ...body })) throw new ApiError(409, "Source rights, robots and terms must be approved before crawling.");
      await supabaseRest(`procurement_sources?id=eq.${encodeFilter(input.id)}`, { method: "PATCH", body: JSON.stringify(body) });
      await supabaseRest("audit_log", { method: "POST", body: JSON.stringify({ actor_user_id: user.id, action: "discovery.source.updated", entity_type: "procurement_source", entity_id: input.id, metadata: body }) });
      return Response.json({ data: body });
    }
    if (input.action === "rights") {
      const { data: sources } = await supabaseRest<Array<SourceRights & { slug: string }>>(`procurement_sources?select=*&id=eq.${encodeFilter(input.id)}&limit=1`);
      const source = sources[0];
      if (!source) throw new ApiError(404, "Source not found.");
      const body = {
        reuse_status: input.reuseStatus, license_name: input.licenseName, license_url: input.licenseUrl,
        permission_evidence: input.permissionEvidence, permission_date: input.permissionDate,
        permission_expiry: input.permissionExpiry, permission_notes: input.permissionNotes,
        content_reuse_allowed: input.contentReuseAllowed, commercial_reuse_allowed: input.commercialReuseAllowed,
        document_reuse_allowed: input.documentReuseAllowed, metadata_reuse_allowed: input.metadataReuseAllowed,
        discovery_auto_publish_enabled: input.autoPublishEnabled,
        last_rights_reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      const next = { ...source, ...body };
      if (source.slug === "ghana-ministry-finance" && (next.discovery_enabled || next.discovery_auto_publish_enabled)) throw new ApiError(409, "Ministry of Finance must remain disabled.");
      const error = validateRights(next);
      if (error) throw new ApiError(409, error);
      await supabaseRest(`procurement_sources?id=eq.${encodeFilter(input.id)}`, { method: "PATCH", body: JSON.stringify(body) });
      await supabaseRest("audit_log", { method: "POST", body: JSON.stringify({ actor_user_id: user.id, action: "discovery.rights.updated", entity_type: "procurement_source", entity_id: input.id, metadata: { old_status: source.reuse_status, new_status: input.reuseStatus } }) });
      return Response.json({ data: body });
    }
    const result = await reviewDiscovery(input.id, input.action, user.id, { matchId: input.matchId, extracted: input.extracted });
    return Response.json({ data: result });
  } catch (error) { return apiErrorResponse(error); }
}
