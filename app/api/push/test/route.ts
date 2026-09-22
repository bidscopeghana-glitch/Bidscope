import { apiErrorResponse, ApiError } from "@/lib/server/api-error";
import { requireUser } from "@/lib/server/auth";
import { createNotification, stableDedupe } from "@/lib/server/notifications";
import { supabaseRest } from "@/lib/server/supabase-rest";
import { eligiblePushSubscriptions, pushConfigured, sendPushDelivery } from "@/lib/server/web-push";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) throw new ApiError(403, "Invalid request origin.", "invalid_origin");
    const { user } = await requireUser(request);
    if (!pushConfigured()) throw new ApiError(503, "Push notifications are not configured yet.", "push_unavailable");
    if (!(await eligiblePushSubscriptions(user.id, "account")).length) throw new ApiError(400, "Enable notifications on a device first.", "no_push_device");
    const key = stableDedupe(["push-test", user.id, new Date().toISOString().slice(0, 16)]);
    const notification = await createNotification({ userId: user.id, type: "system", title: "BidScope notifications are working", message: "Your device is ready for important BidScope alerts.", relatedUrl: "/notifications", pushEventKey: "account", frequencyOverride: "instant", dedupeKey: key });
    if (!notification) throw new ApiError(429, "Please wait a minute before sending another test.", "test_rate_limited");
    const result = await sendPushDelivery(notification.id, user.id);
    await supabaseRest(`notification_deliveries?notification_id=eq.${notification.id}&channel=eq.push`, { method: "PATCH", body: JSON.stringify({ status: result.accepted ? "sent" : "failed", sent_at: result.accepted ? new Date().toISOString() : null, failure_reason: result.accepted ? null : "No push service accepted the test notification." }) });
    return Response.json({ acceptedByPushService: result.accepted, failed: result.failed, expired: result.expired });
  } catch (error) { return apiErrorResponse(error); }
}
