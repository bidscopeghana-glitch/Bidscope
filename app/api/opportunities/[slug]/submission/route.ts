import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireUser } from "@/lib/server/auth";
import { getSubmissionDestination } from "@/lib/server/procurement/submission";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";
type Opportunity = { id: string; source_id: string | null; source_name: string; official_submission_url: string | null; official_tender_url: string | null; official_source_url: string };

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { user } = await requireUser(request); const { slug: opportunityId } = await context.params;
    const { data } = await supabaseRest<Opportunity[]>(`procurement_opportunities?select=id,source_id,source_name,official_submission_url,official_tender_url,official_source_url&id=eq.${encodeURIComponent(opportunityId)}&limit=1`);
    const opportunity = data[0]; if (!opportunity) throw new ApiError(404, "Opportunity not found.", "not_found");
    const submission = getSubmissionDestination(opportunity); const now = new Date().toISOString();
    await Promise.all([
      supabaseRest("submission_clicks", { method: "POST", body: JSON.stringify({ user_id: user.id, opportunity_id: opportunityId, source_id: opportunity.source_id, destination_url: submission.destination }) }),
      supabaseRest("user_bid_tracking?on_conflict=user_id,opportunity_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ user_id: user.id, opportunity_id: opportunityId, status: "OFFICIAL_SUBMISSION_OPENED", official_submission_opened_at: now }) }),
      supabaseRest("analytics_events", { method: "POST", body: JSON.stringify({ user_id: user.id, opportunity_id: opportunityId, source_id: opportunity.source_id, event_name: "official_submission_opened" }) }),
    ]);
    return Response.json({ data: submission });
  } catch (error) { return apiErrorResponse(error); }
}

