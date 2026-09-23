import { apiErrorResponse } from "@/lib/server/api-error";
import { requireCronOrInternalSecret } from "@/lib/server/auth";
import { ingestAwards, ingestNormalizedRecords, ingestProjects } from "@/lib/server/procurement/ingestion";
import { getProcurementAdapter } from "@/lib/server/procurement/registry";
import type { ProcurementSource } from "@/lib/server/procurement/types";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    requireCronOrInternalSecret(request);
    await supabaseRest("rpc/refresh_procurement_opportunity_statuses", { method: "POST", body: "{}" });
    const { data: sources } = await supabaseRest<ProcurementSource[]>("procurement_sources?select=*&sync_enabled=eq.true&status=in.(ACTIVE,DEGRADED)&implementation_status=eq.LIVE&reuse_status=not.in.(prohibited,public_link_only)");
    const results = await Promise.all(sources.map(async (source) => {
      const adapter = getProcurementAdapter(source.slug);
      if (!adapter) return { source: source.slug, status: "SKIPPED", reason: "No registered adapter" };
      try {
        const raw = await adapter.fetchOpportunities();
        const normalized = (await Promise.allSettled(raw.map((record) => adapter.normaliseOpportunity(record)))).flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
        const opportunityResult = await ingestNormalizedRecords(source, normalized);
        const projects = adapter.fetchProjects ? await adapter.fetchProjects(raw) : [];
        const projectResult = await ingestProjects(source, projects);
        const awards = adapter.fetchAwards ? await adapter.fetchAwards() : [];
        const awardResult = await ingestAwards(source, awards);
        if (opportunityResult.runId) await supabaseRest(`source_sync_runs?id=eq.${opportunityResult.runId}`, { method: "PATCH", body: JSON.stringify({ ghana_opportunity_count: normalized.length, project_count: projects.length, award_count: awards.length }) });
        return { source: source.slug, ...opportunityResult, ...projectResult, ...awardResult, ghanaOpportunities: normalized.length };
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Unknown sync error";
        const completedAt = new Date().toISOString();
        await Promise.allSettled([
          supabaseRest("source_sync_runs", {
            method: "POST",
            body: JSON.stringify({
              source_id: source.id,
              status: "FAILED",
              triggered_by: "schedule",
              started_at: completedAt,
              completed_at: completedAt,
              failed_count: 1,
              error_summary: reason,
              error_details: [{ stage: "source_sync", message: reason }],
            }),
          }),
          supabaseRest(`procurement_sources?id=eq.${source.id}`, {
            method: "PATCH",
            body: JSON.stringify({ last_sync_at: completedAt, last_health_at: completedAt, last_health_message: reason, last_error: reason, status: "DEGRADED", consecutive_failures: (source.consecutive_failures || 0) + 1 }),
          }),
          supabaseRest("procurement_source_alerts", { method: "POST", body: JSON.stringify({ source_id: source.id, severity: "CRITICAL", alert_type: "SOURCE_SYNC_FAILED", message: reason, details: { slug: source.slug, endpoint: source.endpoint_url } }) }),
        ]);
        return { source: source.slug, status: "FAILED", reason };
      }
    }));
    return Response.json({ results });
  } catch (error) { return apiErrorResponse(error); }
}
