import { z } from "zod";
import { createHash } from "node:crypto";
import { apiErrorResponse, ApiError } from "@/lib/server/api-error";
import { requireUser } from "@/lib/server/auth";
import { supabaseRest } from "@/lib/server/supabase-rest";
import { allowedPushEndpoint, pushConfigured } from "@/lib/server/web-push";

export const dynamic = "force-dynamic";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({ p256dh: z.string().min(40).max(300), auth: z.string().min(8).max(300) }),
  browser: z.string().max(120).optional(),
  platform: z.string().max(120).optional(),
});

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new ApiError(403, "Invalid request origin.", "invalid_origin");
}

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const { data } = await supabaseRest<Array<{ id: string; browser: string | null; platform: string | null; enabled: boolean; created_at: string; last_used_at: string | null; endpoint: string }>>(`push_subscriptions?select=id,browser,platform,enabled,created_at,last_used_at,endpoint&user_id=eq.${user.id}&order=created_at.desc`);
    return Response.json({ configured: pushConfigured(), publicKey: pushConfigured() ? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY : null, devices: data.map(({ endpoint, ...device }) => ({ ...device, endpointFingerprint: createHash("sha256").update(endpoint).digest("hex").slice(0, 16) })) });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { user } = await requireUser(request);
    if (!pushConfigured()) throw new ApiError(503, "Push notifications are not configured yet.", "push_unavailable");
    const input = subscriptionSchema.parse(await request.json());
    if (!allowedPushEndpoint(input.endpoint)) {
      const endpointHost = new URL(input.endpoint).hostname.toLowerCase();
      throw new ApiError(400, `This browser push endpoint (${endpointHost}) is not supported.`, "invalid_push_endpoint");
    }
    const { data: existing } = await supabaseRest<Array<{ id: string; user_id: string }>>(`push_subscriptions?select=id,user_id&endpoint=eq.${encodeURIComponent(input.endpoint)}&limit=1`);
    if (existing[0] && existing[0].user_id !== user.id) throw new ApiError(409, "This browser is already linked to another account. Disable its existing notifications first.", "device_already_linked");
    const body = { user_id: user.id, endpoint: input.endpoint, p256dh: input.keys.p256dh, auth: input.keys.auth, browser: input.browser || null, platform: input.platform || null, enabled: true, invalidated_at: null, updated_at: new Date().toISOString() };
    const { data } = existing[0]
      ? await supabaseRest<Array<{ id: string }>>(`push_subscriptions?id=eq.${existing[0].id}&user_id=eq.${user.id}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) })
      : await supabaseRest<Array<{ id: string }>>("push_subscriptions", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) });
    return Response.json({ id: data[0]?.id, enabled: true }, { status: existing[0] ? 200 : 201 });
  } catch (error) { return apiErrorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const { user } = await requireUser(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(await request.json());
    await supabaseRest(`push_subscriptions?id=eq.${id}&user_id=eq.${user.id}`, { method: "PATCH", body: JSON.stringify({ enabled: false, updated_at: new Date().toISOString() }) });
    return Response.json({ disabled: true });
  } catch (error) { return apiErrorResponse(error); }
}
