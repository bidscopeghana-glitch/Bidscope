import { createHash } from "node:crypto";
import { after } from "next/server";
import { escapeHtml } from "./alerts";
import { claimMatchingTenderEmail } from "./matching-email-quota";
import { createSecureToken } from "./outreach/campaign";
import { phoneForUser, sendSms, smsProviderConfigured, SMS_EVENT_ALLOWLIST, type SmsEventType } from "./sms";
import { supabaseRest } from "./supabase-rest";
import { eligiblePushSubscriptions, pushEventKeyFor, sendPushDelivery, type PushEventKey } from "./web-push";

export type AlertType = "opportunity_match" | "tender_amendment" | "deadline" | "buyer_activity" | "award" | "supplier_activity" | "document_expiry" | "workspace_reminder" | "system" | "bid_received" | "meeting_reminder" | "bid_awarded" | "otp_verification" | "matching_tender" | "watched_tender_closing";
export type AlertPreference = { user_id:string; alert_type:AlertType; in_app_enabled:boolean; email_enabled:boolean; sms_enabled:boolean; push_enabled:boolean; whatsapp_enabled:boolean; frequency:"instant"|"daily"|"weekly"; urgent_override:boolean; reminder_days:number[] };
export type NotificationInput = { userId:string; organizationId?:string|null; type:AlertType; title:string; message:string; relatedEntityType?:string|null; relatedEntityId?:string|null; relatedUrl?:string|null; priority?:"low"|"normal"|"high"|"urgent"; matchScore?:number|null; matchReasons?:string[]; metadata?:Record<string,unknown>; pushEventKey?:PushEventKey; frequencyOverride?:AlertPreference["frequency"]; dedupeKey:string };

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
  return data[0] || { user_id:userId, alert_type:type, in_app_enabled:true, email_enabled:false, sms_enabled:false, push_enabled:true, whatsapp_enabled:false, frequency:"daily" as const, urgent_override:false, reminder_days:[] };
}

export async function createNotification(input:NotificationInput) {
  const preference = await preferenceFor(input.userId, input.type);
  const smsAllowed=preference.sms_enabled&&SMS_EVENT_ALLOWLIST.has(input.type)&&smsProviderConfigured();
  const eventKey=pushEventKeyFor(input.type,input.relatedEntityType||null,input.pushEventKey);
  const pushAllowed=preference.push_enabled && input.type!=="otp_verification" && (await eligiblePushSubscriptions(input.userId,eventKey)).length>0;
  const channels = [preference.in_app_enabled ? "in_app" : null, preference.email_enabled ? "email" : null, preference.whatsapp_enabled && WHATSAPP_ENABLED ? "whatsapp" : null, smsAllowed ? "sms" : null, pushAllowed ? "push" : null].filter(Boolean) as Array<"in_app"|"email"|"whatsapp"|"sms"|"push">;
  if (!channels.length) return null;
  const { data } = await supabaseRest<Array<{id:string}>>("notifications?on_conflict=user_id,dedupe_key", {
    method:"POST", headers:{ Prefer:"resolution=ignore-duplicates,return=representation" }, body:JSON.stringify({
      user_id:input.userId, organization_id:input.organizationId || null, type:input.type, title:input.title, message:input.message,
      related_entity_type:input.relatedEntityType || null, related_entity_id:input.relatedEntityId || null, related_url:input.relatedUrl || null,
      priority:input.priority || "normal", match_score:input.matchScore ?? null, match_reasons:input.matchReasons || [], metadata:{...input.metadata,pushEventKey:eventKey}, dedupe_key:input.dedupeKey,
    }),
  });
  const notification = data[0];
  if (!notification) return null;
  const urgent = input.priority === "urgent" || input.priority === "high";
  const scheduledFor = digestDate(urgent && preference.urgent_override ? "instant" : input.frequencyOverride||preference.frequency);
  await supabaseRest("notification_deliveries?on_conflict=notification_id,channel", {
    method:"POST", headers:{ Prefer:"resolution=ignore-duplicates" }, body:JSON.stringify(channels.map((channel) => ({
      notification_id:notification.id, channel, status:channel === "in_app" ? "sent" : "pending", provider:channel === "email" ? (process.env.RESEND_API_KEY ? "resend" : null) : channel === "whatsapp" ? process.env.WHATSAPP_PROVIDER : channel === "sms" ? "arkesel" : channel === "push" ? "web_push" : "bidscope", scheduled_for:channel === "push" ? new Date().toISOString() : scheduledFor, sent_at:channel === "in_app" ? new Date().toISOString() : null,
    }))),
  });
  if (pushAllowed) after(async () => {
    try { await processPendingDeliveries(10, "push"); }
    catch (error) { console.error("Web Push background delivery failed", error); }
  });
  return notification;
}

type PendingDelivery = { id:string; channel:"email"|"whatsapp"|"sms"|"push"; retry_count:number; notification:{id:string;user_id:string;type:AlertType;title:string;message:string;related_url:string|null;metadata:Record<string,unknown>;dedupe_key:string} };

async function emailAddress(userId:string) {
  const { data } = await supabaseRest<Array<{email:string}>>(`profiles?select=email&id=eq.${userId}&limit=1`);
  return data[0]?.email || null;
}

async function sendEmail(delivery:PendingDelivery) {
  const key = process.env.RESEND_API_KEY; const from = process.env.ALERT_FROM_EMAIL;
  if (!key || !from) return { status:"skipped", reason:"Email provider is not configured." } as const;
  const owner = await emailAddress(delivery.notification.user_id);
  const extras=Array.isArray(delivery.notification.metadata?.deliveryRecipients)?delivery.notification.metadata.deliveryRecipients.filter((value):value is string=>typeof value==="string"&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)).slice(0,5):[];
  const to=[...new Set([owner,...extras].filter((value):value is string=>Boolean(value)).map((value)=>value.trim().toLowerCase()))];
  if (!to.length) return { status:"failed", reason:"User email address was not found." } as const;
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://www.bidscopeghana.com";
  const href = delivery.notification.related_url ? new URL(delivery.notification.related_url, site).toString() : `${site}/notifications`;
  const unsubscribeToken=createSecureToken({kind:"alerts_unsubscribe",userId:delivery.notification.user_id},365);
  const unsubscribeUrl=`${site}/unsubscribe/${unsubscribeToken}`;
  const oneClickUnsubscribeUrl=`${site}/api/outreach/unsubscribe/${unsubscribeToken}`;
  let sent = 0;
  let providerMessageId: string | null = null;
  let failureReason: string | null = null;
  for (const recipient of to) {
    const deliveryKey=stableDedupe(["notification-email",delivery.id,recipient]);
    if ((delivery.notification.type === "matching_tender" || delivery.notification.type === "opportunity_match") &&
      !(await claimMatchingTenderEmail(recipient, deliveryKey))) continue;
    const response = await fetch("https://api.resend.com/emails", { method:"POST", headers:{ Authorization:`Bearer ${key}`, "Content-Type":"application/json", "Idempotency-Key":deliveryKey }, body:JSON.stringify({
    from, to:[recipient], subject:`BidScope: ${delivery.notification.title}`,
    headers:{"List-Unsubscribe":`<${oneClickUnsubscribeUrl}>`,"List-Unsubscribe-Post":"List-Unsubscribe=One-Click"},
    html:`<div style="background:#f7f2e7;padding:32px;font-family:Arial,sans-serif;color:#17362d"><div style="max-width:620px;margin:auto;background:#fffdf8;border-radius:20px;padding:28px"><p style="color:#116149;font-weight:700;letter-spacing:.12em;font-size:11px">BIDSCOPE PROCUREMENT INTELLIGENCE</p><h2>${escapeHtml(delivery.notification.title)}</h2><p style="line-height:1.7;color:#526a61">${escapeHtml(delivery.notification.message)}</p><p><a href="${escapeHtml(href)}" style="display:inline-block;background:#116149;color:white;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">View in BidScope</a></p><p style="font-size:12px;color:#718078">Always review the official tender documents before submitting a bid.</p><p style="font-size:11px;color:#89968f"><a href="${site}/customer/alerts">Manage alert settings</a> · <a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe from alert emails</a></p></div></div>`,
    }) });
    const result = await response.json().catch(() => ({})) as {id?:string;message?:string};
    if (response.ok) { sent++; providerMessageId ||= result.id || null; }
    else failureReason = result.message || `Email provider returned ${response.status}.`;
  }
  return sent ? { status:"sent", providerMessageId } as const : failureReason ? { status:"failed", reason:failureReason } as const : { status:"skipped", reason:"Three matching-tender emails have already been reserved for this recipient today." } as const;
}

export async function sendWhatsAppAlert() {
  if (!WHATSAPP_ENABLED) return { status:"skipped", reason:"WhatsApp provider is not configured." } as const;
  return { status:"failed", reason:"Configured WhatsApp provider adapter is not implemented." } as const;
}

async function sendSmsAlert(delivery:PendingDelivery){
  if(!SMS_EVENT_ALLOWLIST.has(delivery.notification.type))return{status:"failed",reason:"SMS is not permitted for this event.",transient:false} as const;
  const phone=await phoneForUser(delivery.notification.user_id);
  if(!phone)return{status:"skipped",reason:"A verified mobile number is required."} as const;
  return sendSms({userId:delivery.notification.user_id,phoneNumber:phone,eventType:delivery.notification.type as SmsEventType,message:`BidScope: ${delivery.notification.message}`.slice(0,480),dedupeKey:`notification:${delivery.notification.dedupe_key}`,notificationId:delivery.notification.id,deliveryId:delivery.id,metadata:{relatedUrl:delivery.notification.related_url}});
}

export async function processPendingDeliveries(limit = 100, channel?: "push") {
  const query = new URLSearchParams({ select:"id,channel,retry_count,notification:notifications(id,user_id,type,title,message,related_url,metadata,dedupe_key)", status:"eq.pending", scheduled_for:`lte.${new Date().toISOString()}`, order:"scheduled_for.asc", limit:String(limit) });
  if(channel)query.set("channel",`eq.${channel}`);
  const { data } = await supabaseRest<PendingDelivery[]>(`notification_deliveries?${query}`);
  const counts = { sent:0, failed:0, skipped:0 };
  for (const delivery of data) {
    const {data:claimed}=await supabaseRest<Array<{id:string}>>(`notification_deliveries?id=eq.${delivery.id}&status=eq.pending`, { method:"PATCH", headers:{Prefer:"return=representation"}, body:JSON.stringify({status:"processing"}) });
    if(!claimed.length)continue;
    const result = delivery.channel === "push" ? await (async()=>{const sent=await sendPushDelivery(delivery.notification.id,delivery.notification.user_id);return sent.accepted>0?{status:"sent" as const,providerMessageId:null}:sent.failed>0?{status:"failed" as const,reason:"Push service did not accept the notification."}:{status:"skipped" as const,reason:"No active push subscription accepted the notification."};})() : delivery.channel === "email" ? await sendEmail(delivery) : delivery.channel === "sms" ? await sendSmsAlert(delivery) : await sendWhatsAppAlert();
    counts[result.status]++;
    const retry=result.status==="failed"&&delivery.retry_count<2&&(delivery.channel==="push"||("transient" in result&&result.transient));
    await supabaseRest(`notification_deliveries?id=eq.${delivery.id}`, { method:"PATCH", body:JSON.stringify(result.status === "sent" ? {status:"sent",sent_at:new Date().toISOString(),provider_message_id:"providerMessageId" in result ? result.providerMessageId : null,failure_reason:null} : retry ? {status:"pending",scheduled_for:new Date(Date.now()+Math.pow(2,delivery.retry_count)*60_000).toISOString(),failure_reason:result.reason,retry_count:delivery.retry_count+1} : {status:result.status,failed_at:result.status === "failed" ? new Date().toISOString() : null,failure_reason:result.reason,retry_count:delivery.retry_count + (result.status === "failed" ? 1 : 0)}) });
  }
  return { processed:data.length, ...counts };
}
