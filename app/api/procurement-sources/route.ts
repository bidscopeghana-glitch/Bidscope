import { apiErrorResponse } from "@/lib/server/api-error";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const select = "id,name,slug,organisation,base_url,country_code,integration_type,implementation_status,api_enabled,api_key_required,environment_key_name,sync_enabled,sync_frequency,last_sync_at,last_success_at,last_error,status,trust_level";
    const { data } = await supabaseRest<unknown[]>(`procurement_sources?select=${select}&order=name.asc`);
    return Response.json({ data });
  } catch (error) { return apiErrorResponse(error); }
}

