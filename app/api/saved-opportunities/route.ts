import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireOrganizationMember, requireUser } from "@/lib/server/auth";
import { savedOpportunitySchema } from "@/lib/server/schemas";
import { supabaseRest } from "@/lib/server/supabase-rest";
import {requireResourceCapacity} from "@/lib/server/entitlements";
import {canViewTenderSource} from "@/lib/server/tender-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) throw new ApiError(400, "organizationId is required.", "validation_error");
    await requireOrganizationMember(user.id, organizationId);
    const access=await canViewTenderSource(request);
    if(!access.allowed)throw new ApiError(402,"Saved tender details require an active BidScope subscription.","subscription_required");
    const query = new URLSearchParams({
      select: "notes,pipeline_stage,created_at,updated_at,opportunity:procurement_opportunities(*,buyer:procuring_entities(id,name,slug))",
      organization_id: `eq.${organizationId}`,
      order: "updated_at.desc",
    });
    const { data } = await supabaseRest<unknown[]>(`saved_opportunities?${query}`);
    return Response.json({ data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireUser(request);
    const input = savedOpportunitySchema.parse(await request.json());
    await requireOrganizationMember(user.id, input.organizationId);
    const {data:existing}=await supabaseRest<unknown[]>(`saved_opportunities?select=organization_id&organization_id=eq.${input.organizationId}&opportunity_id=eq.${input.opportunityId}&limit=1`);
    if(!existing.length)await requireResourceCapacity({organizationId:input.organizationId,limitKey:"saved_opportunities",table:"saved_opportunities",selectColumn:"opportunity_id",actor:user});
    const { data } = await supabaseRest<unknown[]>("saved_opportunities?on_conflict=organization_id,opportunity_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ organization_id: input.organizationId, opportunity_id: input.opportunityId, saved_by: user.id, notes: input.notes, pipeline_stage: input.pipelineStage }),
    });
    return Response.json({ data: data[0] }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { user } = await requireUser(request);
    const params = new URL(request.url).searchParams;
    const organizationId = params.get("organizationId");
    const opportunityId = params.get("opportunityId");
    if (!organizationId || !opportunityId) throw new ApiError(400, "organizationId and opportunityId are required.", "validation_error");
    await requireOrganizationMember(user.id, organizationId);
    const query = new URLSearchParams({ organization_id: `eq.${organizationId}`, opportunity_id: `eq.${opportunityId}` });
    await supabaseRest(`saved_opportunities?${query}`, { method: "DELETE" });
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
