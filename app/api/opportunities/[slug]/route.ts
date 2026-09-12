import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { getSubmissionDestination } from "@/lib/server/procurement/submission";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

type Opportunity = { source_name: string; official_submission_url: string | null; official_tender_url: string | null; official_source_url: string } & Record<string, unknown>;

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const query = new URLSearchParams({
      select: "*,project:procurement_projects(id,external_project_id,name,country,region,sector,status,financing_institution,official_url,last_verified_at),buyer:procuring_entities(id,name,slug,entity_type,region,website,source_url),documents:opportunity_documents(id,title,document_type,url,mime_type,size_bytes),sources:opportunity_sources(id,external_id,official_url,submission_url,is_preferred,last_verified_at,source:procurement_sources(id,name,slug,organisation,integration_type,trust_level))",
      slug: `eq.${slug.slice(0, 220)}`, published_at: "not.is.null", status: "neq.DRAFT", limit: "1",
    });
    const { data } = await supabaseRest<Opportunity[]>(`procurement_opportunities?${query}`);
    if (!data.length) throw new ApiError(404, "Opportunity not found.", "not_found");
    const opportunity = data[0];
    return Response.json({ data: { ...opportunity, submission: getSubmissionDestination(opportunity), intelligence: { buyerHistory: "Not enough verified data available.", pastWinners: "Not enough verified data available.", competition: "Not enough verified data available.", seasonality: "Not enough verified data available." } } });
  } catch (error) { return apiErrorResponse(error); }
}
