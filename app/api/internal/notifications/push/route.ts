import { apiErrorResponse } from "@/lib/server/api-error";
import { requireCronOrInternalSecret } from "@/lib/server/auth";
import { processPendingDeliveries } from "@/lib/server/notifications";
import { generateMeetingReminders } from "@/lib/server/scheduled-sms-alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    requireCronOrInternalSecret(request);
    const meetingReminders = await generateMeetingReminders();
    return Response.json({ meetingReminders, deliveries: await processPendingDeliveries(50, "push") });
  } catch (error) { return apiErrorResponse(error); }
}
