import { apiErrorResponse } from "@/lib/server/api-error";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await supabaseRest("opportunities?select=id&limit=1");
    return Response.json({ status: "ok", database: "connected", timestamp: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

