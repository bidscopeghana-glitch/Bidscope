import { z } from "zod";
import { apiErrorResponse } from "@/lib/server/api-error";
import { requireInternalSecret } from "@/lib/server/auth";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

const schema = z.object({
  eventId: z.string().trim().min(1).max(240),
  eventType: z.string().trim().min(1).max(160),
  provider: z.string().trim().min(1).max(80),
  organizationId: z.string().uuid(),
  providerCustomerId: z.string().trim().max(240).nullable().optional(),
  providerSubscriptionId: z.string().trim().max(240).nullable().optional(),
  planCode: z.string().trim().min(1).max(80),
  status: z.enum(["trialing", "active", "past_due", "paused", "cancelled", "expired"]),
  trialEndsAt: z.string().datetime({ offset: true }).nullable().optional(),
  currentPeriodStartsAt: z.string().datetime({ offset: true }).nullable().optional(),
  currentPeriodEndsAt: z.string().datetime({ offset: true }).nullable().optional(),
  cancelAtPeriodEnd: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(request: Request) {
  try {
    requireInternalSecret(request);
    const input = schema.parse(await request.json());
    await supabaseRest("webhook_events?on_conflict=provider,provider_event_id", {
      method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({ provider: input.provider, provider_event_id: input.eventId, event_type: input.eventType, payload: input }),
    });
    const { data } = await supabaseRest<unknown[]>("subscriptions?on_conflict=organization_id", {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        organization_id: input.organizationId, provider: input.provider,
        provider_customer_id: input.providerCustomerId ?? null, provider_subscription_id: input.providerSubscriptionId ?? null,
        plan_code: input.planCode, status: input.status, trial_ends_at: input.trialEndsAt ?? null,
        current_period_starts_at: input.currentPeriodStartsAt ?? null, current_period_ends_at: input.currentPeriodEndsAt ?? null,
        cancel_at_period_end: input.cancelAtPeriodEnd, metadata: input.metadata,
      }),
    });
    await supabaseRest(`webhook_events?provider=eq.${encodeURIComponent(input.provider)}&provider_event_id=eq.${encodeURIComponent(input.eventId)}`, {
      method: "PATCH", body: JSON.stringify({ status: "processed", processed_at: new Date().toISOString() }),
    });
    return Response.json({ data: data[0] });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

