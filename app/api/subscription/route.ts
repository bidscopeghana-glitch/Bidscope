import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireOrganizationMember, requireUser } from "@/lib/server/auth";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) throw new ApiError(400, "organizationId is required.", "validation_error");
    await requireOrganizationMember(user.id, organizationId);
    const query = new URLSearchParams({ select: "plan_code,status,trial_ends_at,current_period_starts_at,current_period_ends_at,cancel_at_period_end", organization_id: `eq.${organizationId}`, limit: "1" });
    const { data } = await supabaseRest<unknown[]>(`subscriptions?${query}`);
    return Response.json({ data: data[0] || { plan_code: "free", status: "active" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

