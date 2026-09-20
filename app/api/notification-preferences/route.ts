import { apiErrorResponse } from "@/lib/server/api-error";
import { ApiError } from "@/lib/server/api-error";
import { requireUser } from "@/lib/server/auth";
import { alertPreferenceUpdateSchema } from "@/lib/server/schemas";
import { maskPhoneNumber, smsProviderConfigured, SMS_EVENT_ALLOWLIST } from "@/lib/server/sms";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

export async function GET(request:Request) {
  try { const { user } = await requireUser(request); const [{ data },{data:profiles}] = await Promise.all([supabaseRest<unknown[]>(`alert_preferences?select=*&user_id=eq.${user.id}&order=alert_type.asc`),supabaseRest<Array<{phone_e164:string|null;phone_verified_at:string|null}>>(`profiles?select=phone_e164,phone_verified_at&id=eq.${user.id}&limit=1`)]); const profile=profiles[0]; return Response.json({ data, emailConfigured:Boolean(process.env.RESEND_API_KEY && process.env.ALERT_FROM_EMAIL), smsConfigured:smsProviderConfigured(), phone:{masked:profile?.phone_e164?maskPhoneNumber(profile.phone_e164):null,verified:Boolean(profile?.phone_verified_at)}, smsEvents:[...SMS_EVENT_ALLOWLIST] }); }
  catch (error) { return apiErrorResponse(error); }
}

export async function PATCH(request:Request) {
  try { const { user } = await requireUser(request); const input = alertPreferenceUpdateSchema.parse(await request.json()); const emailConfigured=Boolean(process.env.RESEND_API_KEY && process.env.ALERT_FROM_EMAIL); if(input.smsEnabled&&!SMS_EVENT_ALLOWLIST.has(input.alertType))throw new ApiError(400,"SMS is not available for this notification type.","sms_event_not_allowed"); const{data:profiles}=await supabaseRest<Array<{phone_verified_at:string|null}>>(`profiles?select=phone_verified_at&id=eq.${user.id}&limit=1`); if(input.smsEnabled&&!profiles[0]?.phone_verified_at)throw new ApiError(400,"Verify a mobile number before enabling SMS alerts.","phone_verification_required"); const { data } = await supabaseRest<unknown[]>(`alert_preferences?user_id=eq.${user.id}&alert_type=eq.${input.alertType}`, { method:"PATCH", headers:{Prefer:"return=representation"}, body:JSON.stringify({in_app_enabled:input.inAppEnabled,email_enabled:emailConfigured&&input.emailEnabled,sms_enabled:smsProviderConfigured()&&input.smsEnabled,frequency:input.frequency,urgent_override:input.urgentOverride,reminder_days:input.reminderDays,whatsapp_enabled:false}) }); return Response.json({data:data[0],emailConfigured,smsConfigured:smsProviderConfigured()}); }
  catch (error) { return apiErrorResponse(error); }
}
