import { z } from "zod";
import { apiErrorResponse } from "@/lib/server/api-error";
import { requireSuperAdmin } from "@/lib/server/auth";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";
const filters = z.object({
  query: z.string().trim().max(160).optional(), buyer: z.string().trim().max(160).optional(),
  supplier: z.string().trim().max(160).optional(), category: z.string().trim().max(80).optional(),
  year: z.coerce.number().int().min(2010).max(2100).optional(), method: z.string().trim().max(80).optional(),
  awarded: z.enum(["true", "false"]).optional(), minValue: z.coerce.number().min(0).optional(),
  maxValue: z.coerce.number().min(0).optional(), currency: z.string().trim().length(3).optional(),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
});

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request);
    const values = Object.fromEntries(new URL(request.url).searchParams);
    const input = filters.parse(values);
    const { data: sources } = await supabaseRest<Array<{ id: string }>>("procurement_sources?select=id&slug=eq.ghaneps&limit=1");
    const sourceId = sources[0]?.id;
    if (!sourceId) return Response.json({ data: [] }, { headers: { "Cache-Control": "private, no-store" } });
    const { data } = await supabaseRest("rpc/search_ocds_processes", { method: "POST", body: JSON.stringify({
      p_source_id: sourceId, p_query: input.query || null, p_buyer: input.buyer || null,
      p_supplier: input.supplier || null, p_category: input.category || null,
      p_year: input.year || null, p_method: input.method || null,
      p_awarded: input.awarded === undefined ? null : input.awarded === "true",
      p_min_value: input.minValue ?? null, p_max_value: input.maxValue ?? null,
      p_currency: input.currency || null, p_limit: 25, p_offset: input.offset,
    }) });
    return Response.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
