import { apiErrorResponse } from "@/lib/server/api-error";
import { pagination, safeSearchTerm, totalFromContentRange } from "@/lib/server/query";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const incoming = new URL(request.url).searchParams;
    const { page, pageSize, offset } = pagination(incoming);
    const search = safeSearchTerm(incoming.get("q"));
    const query = new URLSearchParams({
      select: "id,name,slug,entity_type,region,website,source_url,description,metadata",
      country_code: `eq.${(incoming.get("country") || "GH").slice(0, 2).toUpperCase()}`,
      order: "name.asc",
      limit: String(pageSize),
      offset: String(offset),
    });
    if (search) query.set("name", `ilike.*${search}*`);
    const { data, response } = await supabaseRest<unknown[]>(`procuring_entities?${query}`, { count: "exact" });
    return Response.json({ data, pagination: { page, pageSize, total: totalFromContentRange(response.headers.get("content-range")) } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

