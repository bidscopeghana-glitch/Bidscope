import { apiErrorResponse } from "@/lib/server/api-error";
import { pagination, safeSearchTerm, totalFromContentRange } from "@/lib/server/query";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const incoming = new URL(request.url).searchParams;
    const { page, pageSize, offset } = pagination(incoming);
    const query = new URLSearchParams({
      select: "id,bidscope_reference,slug,title,summary,buyer_name,buyer_type,country,region,sector,category,subcategory,procurement_method,contract_type,currency,estimated_value,minimum_value,maximum_value,published_at,deadline_at,status,source_id,source_name,source_type,external_reference,official_source_url,official_tender_url,official_submission_url,submission_platform,requires_registration,funding_source,funding_agency,eligibility_country,last_verified_at,data_confidence,verification_status,sources:opportunity_sources(id,official_url,submission_url,is_preferred,last_verified_at,source:procurement_sources(id,name,slug,organisation,integration_type,trust_level))",
      published_at: "not.is.null",
      status: `eq.${incoming.get("status")?.toUpperCase() === "CLOSED" ? "CLOSED" : "OPEN"}`,
      country_code: `eq.${(incoming.get("country") || "GH").slice(0, 2).toUpperCase()}`,
      order: incoming.get("sort") === "newest" ? "published_at.desc.nullslast" : "deadline_at.asc.nullslast",
      limit: String(pageSize), offset: String(offset),
    });
    const directFilters: Record<string, string> = {
      category: "category", region: "region", sector: "sector", buyer: "buyer_name", source: "source_name",
      fundingSource: "funding_source", contractType: "contract_type", noticeType: "contract_type", procurementMethod: "procurement_method", eligibility: "eligibility_country", project: "source_resource_id",
    };
    for (const [parameter, column] of Object.entries(directFilters)) {
      const value = safeSearchTerm(incoming.get(parameter), 160);
      if (value) query.set(column, `ilike.*${value}*`);
    }
    const minimumValue = Number(incoming.get("minimumValue"));
    const maximumValue = Number(incoming.get("maximumValue"));
    if (incoming.has("minimumValue") && Number.isFinite(minimumValue) && minimumValue >= 0) query.append("estimated_value", `gte.${minimumValue}`);
    if (incoming.has("maximumValue") && Number.isFinite(maximumValue) && maximumValue >= 0) query.append("estimated_value", `lte.${maximumValue}`);
    const deadlineBefore = incoming.get("deadlineBefore");
    if (deadlineBefore && !Number.isNaN(Date.parse(deadlineBefore))) query.set("deadline_at", `lte.${new Date(deadlineBefore).toISOString()}`);
    const search = safeSearchTerm(incoming.get("q"));
    if (search) query.set("or", `(title.ilike.*${search}*,summary.ilike.*${search}*,buyer_name.ilike.*${search}*,external_reference.ilike.*${search}*,source_resource_id.ilike.*${search}*,sector.ilike.*${search}*,funding_agency.ilike.*${search}*)`);

    const { data, response } = await supabaseRest<unknown[]>(`procurement_opportunities?${query}`, { count: "exact" });
    return Response.json({ data, pagination: { page, pageSize, total: totalFromContentRange(response.headers.get("content-range")) } });
  } catch (error) { return apiErrorResponse(error); }
}
