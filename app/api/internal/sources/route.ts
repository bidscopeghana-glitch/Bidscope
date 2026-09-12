import { apiErrorResponse } from "@/lib/server/api-error";
import { requireInternalSecret } from "@/lib/server/auth";
import { sourceSchema } from "@/lib/server/schemas";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireInternalSecret(request);
    const { data } = await supabaseRest<unknown[]>("ingestion_sources?select=*&order=name.asc");
    return Response.json({ data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    requireInternalSecret(request);
    const input = sourceSchema.parse(await request.json());
    const { data } = await supabaseRest<unknown[]>("ingestion_sources?on_conflict=name,country_code", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ name: input.name, source_type: input.sourceType, country_code: input.countryCode, base_url: input.baseUrl ?? null, enabled: input.enabled, schedule: input.schedule ?? null, configuration: input.configuration }),
    });
    return Response.json({ data: data[0] }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

