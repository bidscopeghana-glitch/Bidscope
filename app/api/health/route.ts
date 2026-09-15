import { apiErrorResponse } from "@/lib/server/api-error";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await supabaseRest("opportunities?select=id&limit=1");
    return Response.json({
      status: "ok",
      core: { database: "connected", authentication: "configured" },
      optional: {
        payments: process.env.PAYSTACK_SECRET_KEY ? "configured" : "not_configured",
        emailAlerts: process.env.RESEND_API_KEY && process.env.ALERT_FROM_EMAIL ? "configured" : "not_configured",
        aiEnhancement: process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY ? "configured" : "grounded_fallback",
      },
      timestamp: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
