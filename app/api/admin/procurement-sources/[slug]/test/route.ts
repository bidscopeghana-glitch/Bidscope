import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireSuperAdmin } from "@/lib/server/auth";
import { getProcurementAdapter } from "@/lib/server/procurement/registry";
import { assertLegacySourceRights } from "@/lib/server/procurement/source-rights";
import type { ProcurementSource } from "@/lib/server/procurement/types";
import type { SourceRights } from "@/lib/server/discovery/rights";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    await requireSuperAdmin(request);
    const { slug } = await context.params;
    const { data: sources } = await supabaseRest<(ProcurementSource & SourceRights)[]>(`procurement_sources?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`);
    if (!sources[0]) throw new ApiError(404, "Source not found.", "source_not_found");
    assertLegacySourceRights(sources[0]);
    const adapter = getProcurementAdapter(slug);
    if (!adapter) throw new ApiError(404, "No code adapter exists for this source.", "adapter_not_found");
    return Response.json({ data: await adapter.healthCheck() });
  } catch (error) { return apiErrorResponse(error); }
}
