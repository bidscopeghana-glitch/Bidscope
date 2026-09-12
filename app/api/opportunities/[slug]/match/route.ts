import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireOrganizationMember, requireUser } from "@/lib/server/auth";
import { calculateOpportunityMatch, type MatchOpportunity, type MatchProfile } from "@/lib/server/procurement/matching";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { user } = await requireUser(request); const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) throw new ApiError(400, "organizationId is required.", "validation_error");
    await requireOrganizationMember(user.id, organizationId); const { slug: opportunityId } = await context.params;
    const [{ data: profiles }, { data: opportunities }] = await Promise.all([
      supabaseRest<MatchProfile[]>(`organizations?select=sectors,services,products,region,preferred_regions,preferred_minimum_value,preferred_maximum_value,certifications&id=eq.${organizationId}&limit=1`),
      supabaseRest<MatchOpportunity[]>(`procurement_opportunities?select=title,summary,sector,category,region,estimated_value,eligibility_text&id=eq.${opportunityId}&limit=1`),
    ]);
    if (!profiles[0] || !opportunities[0]) throw new ApiError(404, "Profile or opportunity not found.", "not_found");
    return Response.json({ data: calculateOpportunityMatch(profiles[0], opportunities[0]) });
  } catch (error) { return apiErrorResponse(error); }
}
