import { requireSuperAdmin } from "@/lib/server/auth";
import { apiErrorResponse } from "@/lib/server/api-error";
import { supabaseRest } from "@/lib/server/supabase-rest";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { try { await requireSuperAdmin(request); const status = new URL(request.url).searchParams.get("status"); const query = new URLSearchParams({ select: "*", order: "created_at.desc", limit: "200" }); if (status && /^[A-Z_]+$/.test(status)) query.set("status", `eq.${status}`); const { data } = await supabaseRest(`tender_submissions?${query}`); return Response.json({ data }, { headers: { "Cache-Control": "private, no-store" } }); } catch (error) { return apiErrorResponse(error); } }
