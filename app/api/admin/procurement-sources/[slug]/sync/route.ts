import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireSuperAdmin } from "@/lib/server/auth";
import { ingestAwards, ingestNormalizedRecords, ingestProjects } from "@/lib/server/procurement/ingestion";
import { getProcurementAdapter } from "@/lib/server/procurement/registry";
import type { ProcurementSource } from "@/lib/server/procurement/types";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { user } = await requireSuperAdmin(request);
    const { slug } = await context.params;
    const adapter = getProcurementAdapter(slug);
    if (!adapter) throw new ApiError(404, "No code adapter exists for this source.", "adapter_not_found");
    const { data } = await supabaseRest<ProcurementSource[]>(`procurement_sources?select=*&slug=eq.${encodeURIComponent(slug)}&limit=1`);
    const source = data[0];
    if (!source) throw new ApiError(404, "Source not found.", "source_not_found");
    if (source.implementation_status !== "LIVE") throw new ApiError(409, "This source is not live. Use reviewed manual ingestion instead.", "source_not_live");
    const raw = await adapter.fetchOpportunities();
    const normalized = (await Promise.allSettled(raw.map((record) => adapter.normaliseOpportunity(record)))).flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    const opportunityResult = await ingestNormalizedRecords(source, normalized, user.id);
    const projects = adapter.fetchProjects ? await adapter.fetchProjects(raw) : [];
    const projectResult = await ingestProjects(source, projects);
    const awards = adapter.fetchAwards ? await adapter.fetchAwards() : [];
    const awardResult = await ingestAwards(source, awards);
    if (opportunityResult.runId) await supabaseRest(`source_sync_runs?id=eq.${opportunityResult.runId}`, { method: "PATCH", body: JSON.stringify({ ghana_opportunity_count: normalized.length, project_count: projects.length, award_count: awards.length }) });
    return Response.json({ data: { ...opportunityResult, ...projectResult, ...awardResult, ghanaOpportunities: normalized.length } }, { status: 202 });
  } catch (error) { return apiErrorResponse(error); }
}
