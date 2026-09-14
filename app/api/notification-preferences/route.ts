import { apiErrorResponse } from "@/lib/server/api-error";
import { requireUser } from "@/lib/server/auth";
import { alertPreferenceUpdateSchema } from "@/lib/server/schemas";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

export async function GET(request:Request) {
  try { const { user } = await requireUser(request); const { data } = await supabaseRest<unknown[]>(`alert_preferences?select=*&user_id=eq.${user.id}&order=alert_type.asc`); return Response.json({ data, emailConfigured:Boolean(process.env.RESEND_API_KEY && process.env.ALERT_FROM_EMAIL), whatsappConfigured:Boolean(process.env.WHATSAPP_PROVIDER && process.env.WHATSAPP_API_KEY) }); }
  catch (error) { return apiErrorResponse(error); }
}

export async function PATCH(request:Request) {
  try { const { user } = await requireUser(request); const input = alertPreferenceUpdateSchema.parse(await request.json()); const emailConfigured=Boolean(process.env.RESEND_API_KEY && process.env.ALERT_FROM_EMAIL); const { data } = await supabaseRest<unknown[]>(`alert_preferences?user_id=eq.${user.id}&alert_type=eq.${input.alertType}`, { method:"PATCH", headers:{Prefer:"return=representation"}, body:JSON.stringify({in_app_enabled:input.inAppEnabled,email_enabled:emailConfigured&&input.emailEnabled,frequency:input.frequency,urgent_override:input.urgentOverride,reminder_days:input.reminderDays,whatsapp_enabled:false}) }); return Response.json({data:data[0],emailConfigured}); }
  catch (error) { return apiErrorResponse(error); }
}
