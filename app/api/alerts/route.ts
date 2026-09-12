import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireOrganizationMember, requireUser } from "@/lib/server/auth";
import { alertRuleSchema } from "@/lib/server/schemas";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

function row(input: ReturnType<typeof alertRuleSchema.parse>, userId: string) {
  return {
    organization_id: input.organizationId, created_by: userId, name: input.name, enabled: input.enabled,
    frequency: input.frequency, keywords: input.keywords, excluded_keywords: input.excludedKeywords,
    categories: input.categories, sectors: input.sectors, regions: input.regions, buyer_ids: input.buyerIds,
    minimum_value: input.minimumValue ?? null, maximum_value: input.maximumValue ?? null,
    deadline_days_min: input.deadlineDaysMin ?? null, deadline_days_max: input.deadlineDaysMax ?? null,
    email_recipients: input.emailRecipients,
  };
}

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) throw new ApiError(400, "organizationId is required.", "validation_error");
    await requireOrganizationMember(user.id, organizationId);
    const query = new URLSearchParams({ select: "*", organization_id: `eq.${organizationId}`, order: "created_at.desc" });
    const { data } = await supabaseRest<unknown[]>(`alert_rules?${query}`);
    return Response.json({ data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireUser(request);
    const input = alertRuleSchema.parse(await request.json());
    await requireOrganizationMember(user.id, input.organizationId);
    const { data } = await supabaseRest<unknown[]>("alert_rules", {
      method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row(input, user.id)),
    });
    return Response.json({ data: data[0] }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

