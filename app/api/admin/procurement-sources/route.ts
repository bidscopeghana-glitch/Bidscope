import { apiErrorResponse } from "@/lib/server/api-error";
import { requireSuperAdmin } from "@/lib/server/auth";
import { procurementSourceAdminSchema } from "@/lib/server/schemas";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request);
    const { data } = await supabaseRest<unknown[]>("procurement_sources?select=*,runs:source_sync_runs(id,status,started_at,completed_at,records_fetched,ghana_opportunity_count,project_count,award_count,inserted_count,updated_count,duplicate_count,failed_count,error_summary,error_details)&order=name.asc&runs.order=started_at.desc&runs.limit=5");
    return Response.json({ data });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireSuperAdmin(request);
    const input = procurementSourceAdminSchema.parse(await request.json());
    const body = { name: input.name, slug: input.slug, organisation: input.organisation, base_url: input.baseUrl, country_code: input.countryCode, integration_type: input.integrationType, implementation_status: input.implementationStatus, endpoint_url: input.endpointUrl || null, environment_key_name: input.environmentKeyName || null, api_key_required: input.apiKeyRequired, api_enabled: Boolean(input.endpointUrl), sync_enabled: input.syncEnabled, sync_frequency: input.syncFrequency, status: input.status, trust_level: input.trustLevel, configuration: input.configuration, created_by: user.id };
    const { data } = await supabaseRest<unknown[]>("procurement_sources", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) });
    await supabaseRest("audit_log", { method: "POST", body: JSON.stringify({ actor_user_id: user.id, action: "procurement_source.created", entity_type: "procurement_source", entity_id: input.slug, metadata: { integration_type: input.integrationType } }) });
    return Response.json({ data: data[0] }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
