import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireSuperAdmin } from "@/lib/server/auth";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

const DAILY_API = "https://api.daily.co/v1";
const WEBHOOK_URL = "https://www.bidscopeghana.com/api/webhooks/meetings";
const EVENT_TYPES = [
  "meeting.started",
  "meeting.ended",
  "participant.joined",
  "participant.left",
  "recording.started",
  "recording.ready-to-download",
  "recording.error",
  "transcript.started",
  "transcript.ready-to-download",
  "transcript.error",
];

type DailyWebhook = {
  uuid: string;
  url: string;
  state?: string;
  failedCount?: number;
  lastMomentPushed?: string;
  eventTypes?: string[];
};

function configuration() {
  const apiKey = process.env.DAILY_API_KEY;
  const basicAuth = process.env.BIDSCOPE_MEET_WEBHOOK_BASIC_AUTH;
  if (!apiKey || !basicAuth) {
    throw new ApiError(503, "Daily webhook credentials are not configured.", "meeting_webhook_unavailable");
  }
  return { apiKey, basicAuth };
}

async function dailyRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { apiKey } = configuration();
  const response = await fetch(`${DAILY_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init?.body ? { "Content-Type": "text/plain" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  const result = await response.json().catch(() => null) as (T & { info?: string; error?: string }) | null;
  if (!response.ok) {
    throw new ApiError(502, result?.info || result?.error || "Daily rejected the webhook configuration.", "meeting_webhook_failed");
  }
  return result as T;
}

function list(value: unknown): DailyWebhook[] {
  if (Array.isArray(value)) return value as DailyWebhook[];
  if (value && typeof value === "object") {
    const record = value as { data?: unknown; webhooks?: unknown };
    if (Array.isArray(record.data)) return record.data as DailyWebhook[];
    if (Array.isArray(record.webhooks)) return record.webhooks as DailyWebhook[];
  }
  return [];
}

function publicStatus(webhook?: DailyWebhook) {
  return {
    configured: Boolean(webhook),
    uuid: webhook?.uuid ?? null,
    url: webhook?.url ?? WEBHOOK_URL,
    state: webhook?.state ?? "NOT_CONFIGURED",
    failedCount: webhook?.failedCount ?? 0,
    lastMomentPushed: webhook?.lastMomentPushed ?? null,
    eventTypes: webhook?.eventTypes ?? [],
  };
}

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request);
    const webhooks = list(await dailyRequest<unknown>("/webhooks"));
    return Response.json({ data: publicStatus(webhooks.find((item) => item.url === WEBHOOK_URL)) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireSuperAdmin(request);
    const { basicAuth } = configuration();
    const webhooks = list(await dailyRequest<unknown>("/webhooks"));
    const existing = webhooks.find((item) => item.url === WEBHOOK_URL);
    const payload = JSON.stringify({
      url: WEBHOOK_URL,
      basicAuth,
      retryType: "exponential",
      eventTypes: EVENT_TYPES,
    });
    const webhook = await dailyRequest<DailyWebhook>(existing ? `/webhooks/${existing.uuid}` : "/webhooks", {
      method: "POST",
      body: payload,
    });
    await supabaseRest("audit_log", {
      method: "POST",
      body: JSON.stringify({
        actor_user_id: user.id,
        action: existing ? "meetings.webhook.updated" : "meetings.webhook.created",
        entity_type: "meeting_webhook",
        entity_id: webhook.uuid,
        metadata: { url: WEBHOOK_URL, event_types: EVENT_TYPES },
      }),
    });
    return Response.json({ data: publicStatus(webhook) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
