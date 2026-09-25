import { apiErrorResponse } from "@/lib/server/api-error";
import { requireUser } from "@/lib/server/auth";
import { supabaseRpc } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await requireUser(request);
    const { data } = await supabaseRpc<Record<string, unknown>>("market_intelligence_snapshot", {});
    return Response.json({ data }, { headers: { "Cache-Control": "private, max-age=300", Vary: "Authorization" } });
  } catch (error) { return apiErrorResponse(error); }
}
