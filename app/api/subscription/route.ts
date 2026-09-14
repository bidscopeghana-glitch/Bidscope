import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireOrganizationMember, requireUser } from "@/lib/server/auth";
import {getEntitlement} from "@/lib/server/entitlements";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) throw new ApiError(400, "organizationId is required.", "validation_error");
    await requireOrganizationMember(user.id, organizationId);
    const entitlement=await getEntitlement(organizationId);
    return Response.json({ data: {plan_code:entitlement.tier.toLowerCase(),status:entitlement.status,current_period_starts_at:entitlement.subscription?.current_period_starts_at||null,current_period_ends_at:entitlement.subscription?.current_period_ends_at||null,cancel_at_period_end:entitlement.subscription?.cancel_at_period_end||false,features:entitlement.features,limits:entitlement.limits} });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
