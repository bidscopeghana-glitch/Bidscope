import { createHash } from "node:crypto";
import { escapeHtml } from "./alerts";
import { createSecureToken } from "./outreach/campaign";
import { supabaseRest } from "./supabase-rest";

export type AlertType = "opportunity_match" | "tender_amendment" | "deadline" | "buyer_activity" | "award" | "supplier_activity" | "document_expiry" | "workspace_reminder" | "system";
export type AlertPreference = { user_id:string; alert_type:AlertType; in_app_enabled:boolean; email_enabled:boolean; whatsapp_enabled:boolean; frequency:"instant"|"daily"|"weekly"; urgent_override:boolean; reminder_days:number[] };
export type NotificationInput = { userId:string; organizationId?:string|null; type:AlertType; title:string; message:string; relatedEntityType?:string|null; relatedEntityId?:string|null; relatedUrl?:string|null; priority?:"low"|"normal"|"high"|"urgent"; matchScore?:number|null; matchReasons?:string[]; metadata?:Record<string,unknown>; frequencyOverride?:AlertPreference["frequency"]; dedupeKey:string };

export const WHATSAPP_ENABLED = Boolean(process.env.WHATSAPP_PROVIDER && process.env.WHATSAPP_API_KEY);

function digestDate(frequency: AlertPreference["frequency"], now = new Date()) {
  if (frequency === "instant") return now.toISOString();
  const target = new Date(now);
  target.setUTCMinutes(0, 0, 0);
  target.setUTCHours(7);
  if (target <= now) target.setUTCDate(target.getUTCDate() + (frequency === "weekly" ? 7 : 1));
  if (frequency === "weekly") target.setUTCDate(target.getUTCDate() + ((1 - target.getUTCDay() + 7) % 7));
  return target.toISOString();
}

export function stableDedupe(parts: Array<string | number | null | undefined>) {
  return createHash("sha256").update(parts.map((value) => String(value ?? "")).join("|")).digest("hex");
}

export async function preferenceFor(userId:string, type:AlertType) {
  const query = new URLSearchParams({ select:"*", user_id:`eq.${userId}`, alert_type:`eq.${type}`, limit:"1" });
  const { data } = await supabaseRest<AlertPreference[]>(`alert_preferences?${query}`);
  return data[0] || { user_id:userId, alert_type:type, in_app_enabled:true, email_enabled:false, whatsapp_enabled:false, frequency:"daily" as const, urgent_override:false, reminder_days:[] };
}

export async function createNotification(input:NotificationInput) {
  const preference = await preferenceFor(input.userId, input.type);
  const channels = [preference.in_app_enabled ? "in_app" : null, preference.email_enabled ? "email" : null, preference.whatsapp_enabled && WHATSAPP_ENABLED ? "whatsapp" : null].filter(Boolean) as Array<"in_app"|"email"|"whatsapp">;
  if (!channels.length) return null;
  const { data } = await supabaseRest<Array<{id:string}>>("notifications?on_conflict=user_id,dedupe_key", {
    method:"POST", headers:{ Prefer:"resolution=ignore-duplicates,return=representation" }, body:JSON.stringify({
      user_id:input.userId, organization_id:input.organizationId || null, type:input.type, title:input.title, message:input.message,
      related_entity_type:input.relatedEntityType || null, related_entity_id:input.relatedEntityId || null, related_url:input.relatedUrl || null,
      priority:input.priority || "normal", match_score:input.matchScore ?? null, match_reasons:input.matchReasons || [], metadata:input.metadata || {}, dedupe_key:input.dedupeKey,
    }),
  });
  const notification = data[0];
  if (!notification) return null;
  const urgent = input.priority === "urgent" || input.priority === "high";
  const scheduledFor = digestDate(urgent && preference.urgent_override ? "instant" : input.frequencyOverride||preference.frequency);
  await supabaseRest("notification_deliveries?on_conflict=notification_id,channel", {
    method:"POST", headers:{ Prefer:"resolution=ignore-duplicates" }, body:JSON.stringify(channels.map((channel) => ({
      notification_id:notification.id, channel, status:channel === "in_app" ? "sent" : "pending", provider:channel === "email" ? (process.env.RESEND_API_KEY ? "resend" : null) : channel === "whatsapp" ? process.env.WHATSAPP_PROVIDER : "bidscope", scheduled_for:scheduledFor, sent_at:channel === "in_app" ? new Date().toISOString() : null,
    }))),
  });
  return notification;
}

type PendingDelivery = { id:string; channel:"email"|"whatsapp"; retry_count:number; notification:{id:string;user_id:string;title:string;message:string;related_url:string|null;metadata:Record<string,unknown>} };

async function emailAddress(userId:string) {
  const { data } = await supabaseRest<Array<{email:string}>>(`profiles?select=email&id=eq.${userId}&limit=1`);
  return data[0]?.email || null;
}

async function sendEmail(delivery:PendingDelivery) {
  const key = process.env.RESEND_API_KEY; const from = process.env.ALERT_FROM_EMAIL;
  if (!key || !from) return { status:"skipped", reason:"Email provider is not configured." } as const;
  const owner = await emailAddress(delivery.notification.user_id);
  const extras=Array.isArray(delivery.notification.metadata?.deliveryRecipients)?delivery.notification.metadata.deliveryRecipients.filter((value):value is string=>typeof value==="string"&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)).slice(0,5):[];
  const to=[...new Set([owner,...extras].filter((value):value is string=>Boolean(value)))];
  if (!to.length) return { status:"failed", reason:"User email address was not found." } as const;
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://www.bidscopeghana.com";
  const href = delivery.notification.related_url ? new URL(delivery.notification.related_url, site).toString() : `${site}/notifications`;
  const unsubscribeToken=createSecureToken({kind:"alerts_unsubscribe",userId:delivery.notification.user_id},365);
  const unsubscribeUrl=`${site}/unsubscribe/${unsubscribeToken}`;
  const oneClickUnsubscribeUrl=`${site}/api/outreach/unsubscribe/${unsubscribeToken}`;
  const response = await fetch("https://api.resend.com/emails", { method:"POST", headers:{ Authorization:`Bearer ${key}`, "Content-Type":"application/json" }, body:JSON.stringify({
    from, to, subject:`BidScope: ${delivery.notification.title}`,
    headers:{"List-Unsubscribe":`<${oneClickUnsubscribeUrl}>`,"List-Unsubscribe-Post":"List-Unsubscribe=One-Click"},
    html:`<div style="background:#f7f2e7;padding:32px;font-family:Arial,sans-serif;color:#17362d"><div style="max-width:620px;margin:auto;background:#fffdf8;border-radius:20px;padding:28px"><p style="color:#116149;font-weight:700;letter-spacing:.12em;font-size:11px">BIDSCOPE PROCUREMENT INTELLIGENCE</p><h2>${escapeHtml(delivery.notification.title)}</h2><p style="line-height:1.7;color:#526a61">${escapeHtml(delivery.notification.message)}</p><p><a href="${escapeHtml(href)}" style="display:inline-block;background:#116149;color:white;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">View in BidScope</a></p><p style="font-size:12px;color:#718078">Always review the official tender documents before submitting a bid.</p><p style="font-size:11px;color:#89968f"><a href="${site}/customer/alerts">Manage alert settings</a> · <a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe from alert emails</a></p></div></div>`,
  }) });
  const result = await response.json().catch(() => ({})) as {id?:string;message?:string};
  return response.ok ? { status:"sent", providerMessageId:result.id || null } as const : { status:"failed", reason:result.message || `Email provider returned ${response.status}.` } as const;
}

export async function sendWhatsAppAlert() {
  if (!WHATSAPP_ENABLED) return { status:"skipped", reason:"WhatsApp provider is not configured." } as const;
  return { status:"failed", reason:"Configured WhatsApp provider adapter is not implemented." } as const;
}

export async function processPendingDeliveries(limit = 100) {
  const query = new URLSearchParams({ select:"id,channel,retry_count,notification:notifications(id,user_id,title,message,related_url,metadata)", status:"eq.pending", scheduled_for:`lte.${new Date().toISOString()}`, order:"scheduled_for.asc", limit:String(limit) });
  const { data } = await supabaseRest<PendingDelivery[]>(`notification_deliveries?${query}`);
  const counts = { sent:0, failed:0, skipped:0 };
  for (const delivery of data) {
    await supabaseRest(`notification_deliveries?id=eq.${delivery.id}`, { method:"PATCH", body:JSON.stringify({status:"processing"}) });
    const result = delivery.channel === "email" ? await sendEmail(delivery) : await sendWhatsAppAlert();
    counts[result.status]++;
    await supabaseRest(`notification_deliveries?id=eq.${delivery.id}`, { method:"PATCH", body:JSON.stringify(result.status === "sent" ? {status:"sent",sent_at:new Date().toISOString(),provider_message_id:"providerMessageId" in result ? result.providerMessageId : null} : {status:result.status,failed_at:result.status === "failed" ? new Date().toISOString() : null,failure_reason:result.reason,retry_count:delivery.retry_count + (result.status === "failed" ? 1 : 0)}) });
  }
  return { processed:data.length, ...counts };
}
