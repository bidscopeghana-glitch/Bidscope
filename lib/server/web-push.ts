import webpush from "web-push";
import { supabaseRest } from "./supabase-rest";

export const PUSH_EVENT_KEYS = [
  "matching_tender", "public_tender", "private_tender", "tender_deadline", "tender_amendment", "saved_tender_reminder",
  "bid_submitted", "bid_status", "bid_shortlisted", "bid_accepted", "bid_rejected", "clarification_requested",
  "new_bid", "supplier_question", "evaluation_reminder", "procurement_task", "tender_approval",
  "new_message", "team_mention", "meeting_invitation", "meeting_reminder", "meeting_changed", "meeting_cancelled",
  "billing", "security", "verification", "account",
] as const;
export type PushEventKey = typeof PUSH_EVENT_KEYS[number];

export type PushSubscriptionRow = {
  id: string; user_id: string; endpoint: string; p256dh: string; auth: string; enabled: boolean;
};
type DeviceDelivery = { id: string; notification_id: string; subscription_id: string; attempts: number; status: string };
type PushNotice = { id: string; user_id: string; type: string; related_url: string | null; related_entity_type: string | null; related_entity_id: string | null; metadata: Record<string, unknown> };

export function pushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

function configurePush() {
  if (!pushConfigured()) throw new Error("Web Push is not configured.");
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
}

export function allowedPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port && url.port !== "443") return false;
    const hostname = url.hostname.toLowerCase();
    return hostname === "fcm.googleapis.com" || hostname === "android.googleapis.com" ||
      hostname === "updates.push.services.mozilla.com" || hostname === "web.push.apple.com" ||
      hostname === "webpush.push.apple.com" || hostname.endsWith(".notify.windows.com");
  } catch { return false; }
}

export function safeDestination(path: string | null) {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "/notifications";
  try {
    const parsed = new URL(path, "https://www.bidscopeghana.com");
    return parsed.origin === "https://www.bidscopeghana.com" ? parsed.pathname + parsed.search : "/notifications";
  } catch { return "/notifications"; }
}

export function pushEventKeyFor(type: string, entity: string | null, explicit?: string): PushEventKey {
  if (explicit && (PUSH_EVENT_KEYS as readonly string[]).includes(explicit)) return explicit as PushEventKey;
  if (type === "matching_tender" || type === "opportunity_match") return "matching_tender";
  if (type === "tender_amendment") return "tender_amendment";
  if (type === "deadline" || type === "watched_tender_closing") return "tender_deadline";
  if (type === "meeting_reminder") return "meeting_reminder";
  if (type === "bid_received") return "new_bid";
  if (type === "bid_awarded") return "bid_accepted";
  if (entity === "tender_conversation" || entity === "tender_message") return "new_message";
  if (entity === "meeting") return "meeting_invitation";
  if (entity === "subscription") return "billing";
  return "account";
}

export async function eligiblePushSubscriptions(userId: string, eventKey: PushEventKey) {
  if (!pushConfigured()) return [];
  const [{ data: disabled }, { data: subscriptions }] = await Promise.all([
    supabaseRest<Array<{ enabled: boolean }>>(`push_event_preferences?select=enabled&user_id=eq.${userId}&event_key=in.(__all__,${eventKey})&enabled=eq.false&limit=1`),
    supabaseRest<PushSubscriptionRow[]>(`push_subscriptions?select=id,user_id,endpoint,p256dh,auth,enabled&user_id=eq.${userId}&enabled=eq.true&limit=20`),
  ]);
  return disabled.length ? [] : subscriptions;
}

export async function sendPushDelivery(notificationId: string, userId: string) {
  configurePush();
  const { data: notices } = await supabaseRest<PushNotice[]>(`notifications?select=id,user_id,type,related_url,related_entity_type,related_entity_id,metadata&id=eq.${notificationId}&user_id=eq.${userId}&limit=1`);
  const notice = notices[0];
  if (!notice) return { accepted: 0, failed: 0, expired: 0 };
  const eventKey = pushEventKeyFor(notice.type, notice.related_entity_type, typeof notice.metadata?.pushEventKey === "string" ? notice.metadata.pushEventKey : undefined);
  const subscriptions = await eligiblePushSubscriptions(userId, eventKey);
  const counts = { accepted: 0, failed: 0, expired: 0 };
  for (const subscription of subscriptions) {
    await supabaseRest("push_device_deliveries?on_conflict=notification_id,subscription_id", {
      method: "POST", headers: { Prefer: "resolution=ignore-duplicates" },
      body: JSON.stringify({ notification_id: notice.id, subscription_id: subscription.id }),
    });
    const { data: rows } = await supabaseRest<DeviceDelivery[]>(`push_device_deliveries?select=id,notification_id,subscription_id,attempts,status&notification_id=eq.${notice.id}&subscription_id=eq.${subscription.id}&limit=1`);
    const row = rows[0];
    if (!row || !["pending", "failed"].includes(row.status) || row.attempts >= 3) continue;
    const { data: claimed } = await supabaseRest<DeviceDelivery[]>(`push_device_deliveries?id=eq.${row.id}&status=eq.${row.status}`, {
      method: "PATCH", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: "processing", attempts: row.attempts + 1, attempted_at: new Date().toISOString() }),
    });
    if (!claimed.length) continue;
    const payload = JSON.stringify({
      title: eventKey === "new_message" ? "New BidScope message" : "BidScope notification",
      body: eventKey === "new_message" ? "A message is waiting in your BidScope workspace." : "An update is waiting in your BidScope workspace.",
      url: safeDestination(notice.related_url), type: eventKey, notificationId: notice.id,
      tenderId: notice.related_entity_type?.includes("tender") ? notice.related_entity_id : null,
      bidId: notice.related_entity_type?.includes("bid") ? notice.related_entity_id : null,
      meetingId: notice.related_entity_type === "meeting" ? notice.related_entity_id : null,
      conversationId: notice.related_entity_type === "tender_conversation" ? notice.related_entity_id : null,
    });
    try {
      const result = await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload, { TTL: 86400, urgency: "normal" });
      counts.accepted++;
      await supabaseRest(`push_device_deliveries?id=eq.${row.id}`, { method: "PATCH", body: JSON.stringify({ status: "accepted", accepted_at: new Date().toISOString(), response_status: result.statusCode }) });
      await supabaseRest(`push_subscriptions?id=eq.${subscription.id}`, { method: "PATCH", body: JSON.stringify({ last_used_at: new Date().toISOString() }) });
    } catch (error) {
      const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
      const expired = status === 404 || status === 410;
      counts[expired ? "expired" : "failed"]++;
      await supabaseRest(`push_device_deliveries?id=eq.${row.id}`, { method: "PATCH", body: JSON.stringify({ status: expired ? "expired" : "failed", response_status: status || null }) });
      if (expired) await supabaseRest(`push_subscriptions?id=eq.${subscription.id}`, { method: "PATCH", body: JSON.stringify({ enabled: false, invalidated_at: new Date().toISOString() }) });
    }
  }
  return counts;
}
