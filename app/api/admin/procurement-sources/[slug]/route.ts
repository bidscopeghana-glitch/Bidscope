import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireSuperAdmin } from "@/lib/server/auth";
import { procurementSourceAdminSchema } from "@/lib/server/schemas";
import { supabaseRest } from "@/lib/server/supabase-rest";
import { assertLegacySourceRights } from "@/lib/server/procurement/source-rights";
import type { ProcurementSource } from "@/lib/server/procurement/types";
import type { SourceRights } from "@/lib/server/discovery/rights";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { user } = await requireSuperAdmin(request);
    const { slug } = await context.params;
    const input = procurementSourceAdminSchema.partial().parse(await request.json());
    if (!Object.keys(input).length) throw new ApiError(400, "At least one setting is required.", "validation_error");
    if (input.syncEnabled === true || input.status === "ACTIVE") {
      const { data: sources } = await supabaseRest<(ProcurementSource & SourceRights)[]>(`procurement_sources?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`);
      if (!sources[0]) throw new ApiError(404, "Source not found.", "source_not_found");
      assertLegacySourceRights(sources[0]);
    }
    const body = {
      ...(input.name !== undefined && { name: input.name }), ...(input.organisation !== undefined && { organisation: input.organisation }),
      ...(input.baseUrl !== undefined && { base_url: input.baseUrl }), ...(input.countryCode !== undefined && { country_code: input.countryCode }),
      ...(input.integrationType !== undefined && { integration_type: input.integrationType }), ...(input.implementationStatus !== undefined && { implementation_status: input.implementationStatus }),
      ...(input.endpointUrl !== undefined && { endpoint_url: input.endpointUrl }), ...(input.environmentKeyName !== undefined && { environment_key_name: input.environmentKeyName }),
      ...(input.apiKeyRequired !== undefined && { api_key_required: input.apiKeyRequired }), ...(input.syncEnabled !== undefined && { sync_enabled: input.syncEnabled }),
      ...(input.syncFrequency !== undefined && { sync_frequency: input.syncFrequency }), ...(input.status !== undefined && { status: input.status }),
      ...(input.trustLevel !== undefined && { trust_level: input.trustLevel }), ...(input.configuration !== undefined && { configuration: input.configuration }),
    };
    const { data } = await supabaseRest<unknown[]>(`procurement_sources?slug=eq.${encodeURIComponent(slug)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) });
    if (!data.length) throw new ApiError(404, "Source not found.", "source_not_found");
    await supabaseRest("audit_log", { method: "POST", body: JSON.stringify({ actor_user_id: user.id, action: "procurement_source.configuration_changed", entity_type: "procurement_source", entity_id: slug, metadata: { changed_fields: Object.keys(body) } }) });
    return Response.json({ data: data[0] });
  } catch (error) { return apiErrorResponse(error); }
}
