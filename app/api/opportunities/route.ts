import { apiErrorResponse } from "@/lib/server/api-error";
import { pagination, safeSearchTerm, totalFromContentRange } from "@/lib/server/query";
import { supabaseRest } from "@/lib/server/supabase-rest";
import { requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const incoming = new URL(request.url).searchParams;
    if (incoming.get("view") === "live") await requireUser(request);
    const { page, pageSize, offset } = pagination(incoming);
    const query = new URLSearchParams({
      select: "id,bidscope_reference,slug,title,summary,description,buyer_name,buyer_type,country,region,sector,category,subcategory,procurement_method,contract_type,currency,estimated_value,minimum_value,maximum_value,published_at,deadline_at,status,source_id,source_name,source_type,external_reference,official_source_url,official_tender_url,official_submission_url,submission_platform,submission_method,requires_registration,registration_url,funding_source,funding_agency,eligibility_text,eligibility_country,documents_url,contact_name,contact_email,contact_phone,last_verified_at,data_confidence,verification_status,sources:opportunity_sources(id,official_url,submission_url,is_preferred,last_verified_at,source:procurement_sources(id,name,slug,organisation,integration_type,trust_level))",
      published_at: "not.is.null",
      source_removed_at: "is.null",
      status: incoming.get("stage") === "upcoming" ? "eq.UPCOMING" : incoming.get("stage") === "awarded" ? "eq.AWARDED" : "in.(OPEN,CLOSING_SOON)",
      order: incoming.get("sort") === "newest" ? "published_at.desc.nullslast" : "deadline_at.asc.nullslast",
      limit: String(pageSize), offset: String(offset),
    });
    const stage = incoming.get("stage");
    if (stage !== "upcoming" && stage !== "awarded") {
      query.append("deadline_at", `gt.${new Date().toISOString()}`);
    }
    const scope = incoming.get("scope") || "ghana";
    let scopeOr: string | null = null;
    if (scope === "ghana") query.set("country_code", "eq.GH");
    else if (scope === "international") query.set("country_code", "neq.GH");
    else if (scope === "africa") scopeOr = "source_name.in.(African Union,ECOWAS,African Development Bank),country_code.in.(DZ,AO,BJ,BW,BF,BI,CV,CM,CF,TD,KM,CD,CG,CI,DJ,EG,GQ,ER,SZ,ET,GA,GM,GH,GN,GW,KE,LS,LR,LY,MG,MW,ML,MR,MU,MA,MZ,NA,NE,NG,RW,ST,SN,SC,SL,SO,ZA,SS,SD,TZ,TG,TN,UG,ZM,ZW)";
    else if (incoming.get("country")) query.set("country_code", `eq.${incoming.get("country")!.slice(0, 2).toUpperCase()}`);
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
    if (deadlineBefore && !Number.isNaN(Date.parse(deadlineBefore))) query.append("deadline_at", `lte.${new Date(deadlineBefore).toISOString()}`);
    const search = safeSearchTerm(incoming.get("q"));
    const searchOr = search ? `title.ilike.*${search}*,summary.ilike.*${search}*,buyer_name.ilike.*${search}*,external_reference.ilike.*${search}*,source_resource_id.ilike.*${search}*,sector.ilike.*${search}*,funding_agency.ilike.*${search}*` : null;
    if(scopeOr && searchOr)query.set("and",`(or(${scopeOr}),or(${searchOr}))`);
    else if(scopeOr||searchOr)query.set("or",`(${scopeOr||searchOr})`);

    const { data, response } = await supabaseRest<unknown[]>(`procurement_opportunities?${query}`, { count: "exact", serviceRole: false });
    return Response.json({ data, pagination: { page, pageSize, total: totalFromContentRange(response.headers.get("content-range")) } });
  } catch (error) { return apiErrorResponse(error); }
}
