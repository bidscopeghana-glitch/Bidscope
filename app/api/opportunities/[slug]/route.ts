import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { guestOpportunityPreview, type GuestOpportunityInput } from "@/lib/server/procurement/guest-preview";
import { supabaseRest } from "@/lib/server/supabase-rest";
import { requireUser } from "@/lib/server/auth";
import { getSubmissionDestination } from "@/lib/server/procurement/submission";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const authenticated = request.headers.has("authorization");
    if (authenticated) await requireUser(request);
    const { slug } = await context.params;
    const query = new URLSearchParams({
      select: "slug,title,summary,buyer_name,country,country_code,region,sector,category,published_at,deadline_at,status,source_name",
      slug: `eq.${slug.slice(0, 220)}`, published_at: "not.is.null", source_removed_at: "is.null", status: "neq.DRAFT", limit: "1",
    });
    if (authenticated) {
      query.set("select", "*,project:procurement_projects(id,external_project_id,name,country,region,sector,status,financing_institution,official_url,last_verified_at),buyer:procuring_entities(id,name,slug,entity_type,region,website,source_url),documents:opportunity_documents(id,title,document_type,url,mime_type,size_bytes),sources:opportunity_sources(id,external_id,official_url,submission_url,is_preferred,last_verified_at,source:procurement_sources(id,name,slug,organisation,integration_type,trust_level))");
      type FullOpportunity = { source_name: string; official_submission_url: string | null; official_tender_url: string | null; official_source_url: string } & Record<string, unknown>;
      const { data } = await supabaseRest<FullOpportunity[]>(`procurement_opportunities?${query}`);
      if (!data.length) throw new ApiError(404, "Opportunity not found.", "not_found");
      return Response.json({ data: { ...data[0], submission: getSubmissionDestination(data[0]), intelligence: { buyerHistory: "Not enough verified data available.", pastWinners: "Not enough verified data available.", competition: "Not enough verified data available.", seasonality: "Not enough verified data available." } } }, { headers: { "Cache-Control": "private, no-store", Vary: "Authorization" } });
    }
    const { data } = await supabaseRest<GuestOpportunityInput[]>(`procurement_opportunities?${query}`);
    if (!data.length) throw new ApiError(404, "Opportunity not found.", "not_found");
    return Response.json({ data: guestOpportunityPreview(data[0]), access: "preview" }, { headers: { "Cache-Control": "private, no-store", Vary: "Authorization" } });
  } catch (error) { return apiErrorResponse(error); }
}
