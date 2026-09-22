import { z } from "zod";
import { apiErrorResponse, ApiError } from "@/lib/server/api-error";
import { requireUser } from "@/lib/server/auth";
import { supabaseRest } from "@/lib/server/supabase-rest";
import { PUSH_EVENT_KEYS } from "@/lib/server/web-push";

export const dynamic = "force-dynamic";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("event"), eventKey: z.enum(PUSH_EVENT_KEYS), enabled: z.boolean() }),
  z.object({ action: z.literal("all"), enabled: z.boolean() }),
]);

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const [{ data: events }, { data: channels }] = await Promise.all([
      supabaseRest<Array<{ event_key: string; enabled: boolean }>>(`push_event_preferences?select=event_key,enabled&user_id=eq.${user.id}`),
      supabaseRest<Array<{ event_key: string; enabled: boolean }>>(`push_event_preferences?select=event_key,enabled&user_id=eq.${user.id}&event_key=eq.__all__`),
    ]);
    return Response.json({ events, channels, availableEvents: PUSH_EVENT_KEYS });
  } catch (error) { return apiErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) throw new ApiError(403, "Invalid request origin.", "invalid_origin");
    const { user } = await requireUser(request);
    const input = schema.parse(await request.json());
    if (input.action === "event") {
      await supabaseRest("push_event_preferences?on_conflict=user_id,event_key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ user_id: user.id, event_key: input.eventKey, enabled: input.enabled, updated_at: new Date().toISOString() }) });
    } else {
      await supabaseRest("push_event_preferences?on_conflict=user_id,event_key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ user_id: user.id, event_key: "__all__", enabled: input.enabled, updated_at: new Date().toISOString() }) });
      if (input.enabled) await supabaseRest(`push_event_preferences?user_id=eq.${user.id}&event_key=neq.__all__`, { method: "DELETE" });
    }
    return Response.json({ saved: true });
  } catch (error) { return apiErrorResponse(error); }
}
