import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireCronOrInternalSecret } from "@/lib/server/auth";
import { ingestNormalizedRecords } from "@/lib/server/procurement/ingestion";
import { getProcurementAdapter } from "@/lib/server/procurement/registry";
import type { ProcurementSource } from "@/lib/server/procurement/types";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    requireCronOrInternalSecret(request);
    const { slug } = await context.params;
    const adapter = getProcurementAdapter(slug);
    if (!adapter) throw new ApiError(404, "No connector is registered for this source.", "adapter_not_found");
    const { data } = await supabaseRest<ProcurementSource[]>(`procurement_sources?select=*&slug=eq.${encodeURIComponent(slug)}&limit=1`);
    const source = data[0];
    if (!source) throw new ApiError(404, "Procurement source not found.", "source_not_found");
    if (!source.sync_enabled || source.status === "PAUSED") throw new ApiError(409, "This integration is paused.", "source_paused");
    if (source.implementation_status !== "LIVE") throw new ApiError(409, "This source is not classified as live; use the reviewed manual ingestion workflow.", "source_not_live");
    const rawRecords = await adapter.fetchOpportunities();
    const settled = await Promise.allSettled(rawRecords.map((record) => adapter.normaliseOpportunity(record)));
    const normalized = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    const result = await ingestNormalizedRecords(source, normalized);
    return Response.json({ source: source.name, normalized: normalized.length, rejectedDuringNormalization: settled.length - normalized.length, ...result }, { status: 202 });
  } catch (error) { return apiErrorResponse(error); }
}

