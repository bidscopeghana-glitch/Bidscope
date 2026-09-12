import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireOrganizationMember, requireUser } from "@/lib/server/auth";
import { alertRuleUpdateSchema } from "@/lib/server/schemas";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

async function existingRule(id: string) {
  const query = new URLSearchParams({ select: "id,organization_id,created_by", id: `eq.${id}`, limit: "1" });
  const { data } = await supabaseRest<Array<{ id: string; organization_id: string; created_by: string }>>(`alert_rules?${query}`);
  if (!data.length) throw new ApiError(404, "Alert rule not found.", "not_found");
  return data[0];
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireUser(request);
    const { id } = await context.params;
    const existing = await existingRule(id);
    const membership = await requireOrganizationMember(user.id, existing.organization_id);
    if (existing.created_by !== user.id && !["owner", "admin"].includes(membership.role)) {
      throw new ApiError(403, "Only the alert owner or a business administrator can change this rule.", "alert_access_denied");
    }
    const input = alertRuleUpdateSchema.parse(await request.json());
    const updates: Record<string, unknown> = {};
    const names: Record<string, string> = { excludedKeywords: "excluded_keywords", buyerIds: "buyer_ids", minimumValue: "minimum_value", maximumValue: "maximum_value", deadlineDaysMin: "deadline_days_min", deadlineDaysMax: "deadline_days_max", emailRecipients: "email_recipients" };
    for (const [key, value] of Object.entries(input)) updates[names[key] || key] = value;
    const query = new URLSearchParams({ id: `eq.${id}` });
    const { data } = await supabaseRest<unknown[]>(`alert_rules?${query}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(updates) });
    return Response.json({ data: data[0] });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireUser(request);
    const { id } = await context.params;
    const existing = await existingRule(id);
    const membership = await requireOrganizationMember(user.id, existing.organization_id);
    if (existing.created_by !== user.id && !["owner", "admin"].includes(membership.role)) {
      throw new ApiError(403, "Only the alert owner or a business administrator can delete this rule.", "alert_access_denied");
    }
    await supabaseRest(`alert_rules?id=eq.${id}`, { method: "DELETE" });
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
