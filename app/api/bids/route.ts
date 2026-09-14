import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireOrganizationMember, requireUser } from "@/lib/server/auth";
import { bidTrackingSchema } from "@/lib/server/schemas";
import { supabaseRest } from "@/lib/server/supabase-rest";
import {primaryOrganization,requireEntitlement} from "@/lib/server/entitlements";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (organizationId) await requireOrganizationMember(user.id, organizationId);
    const query = new URLSearchParams({ select: "*,opportunity:procurement_opportunities(id,slug,bidscope_reference,title,buyer_name,deadline_at,status,source_name,external_reference)", user_id: `eq.${user.id}`, order: "updated_at.desc" });
    if (organizationId) query.set("organization_id", `eq.${organizationId}`);
    const { data } = await supabaseRest<unknown[]>(`user_bid_tracking?${query}`);
    return Response.json({ data });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireUser(request);
    const input = bidTrackingSchema.parse(await request.json());
    const billingOrganization=input.organizationId||(await primaryOrganization(user.id))?.organization_id;
    if(!billingOrganization)throw new ApiError(400,"Create a business profile before using the bid workspace.","profile_required");
    await requireOrganizationMember(user.id,billingOrganization);await requireEntitlement(billingOrganization,"bid_workspace");
    const now = new Date().toISOString();
    const timestamps = input.status === "PREPARING" ? { preparation_started_at: now } : input.status === "OFFICIAL_SUBMISSION_OPENED" ? { official_submission_opened_at: now } : input.status === "SUBMITTED" ? { submitted_at: now } : {};
    const body = { user_id: user.id, organization_id: billingOrganization, opportunity_id: input.opportunityId, status: input.status, submission_reference: input.submissionReference || null, outcome: input.outcome || null, notes: input.notes, ...timestamps };
    const { data } = await supabaseRest<unknown[]>("user_bid_tracking?on_conflict=user_id,opportunity_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(body) });
    if (!data[0]) throw new ApiError(500, "Bid status could not be saved.", "bid_tracking_failed");
    return Response.json({ data: data[0] });
  } catch (error) { return apiErrorResponse(error); }
}
