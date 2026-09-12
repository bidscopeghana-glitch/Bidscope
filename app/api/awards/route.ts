import { apiErrorResponse } from "@/lib/server/api-error";
import { pagination, safeSearchTerm, totalFromContentRange } from "@/lib/server/query";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const incoming = new URL(request.url).searchParams;
    const { page, pageSize, offset } = pagination(incoming);
    const search = safeSearchTerm(incoming.get("q"));
    const query = new URLSearchParams({
      select: "id,title,reference_number,award_date,currency,award_value,procurement_method,source_url,buyer:procuring_entities(id,name,slug),suppliers:award_suppliers(id,supplier_name,supplier_registration_number,country_code,awarded_value,is_joint_venture)",
      country_code: `eq.${(incoming.get("country") || "GH").slice(0, 2).toUpperCase()}`,
      published_at: "not.is.null",
      order: "award_date.desc.nullslast",
      limit: String(pageSize),
      offset: String(offset),
    });
    if (search) query.set("or", `(title.ilike.*${search}*,reference_number.ilike.*${search}*)`);
    const buyer = incoming.get("buyer");
    if (buyer) query.set("buyer_id", `eq.${buyer}`);
    const { data, response } = await supabaseRest<unknown[]>(`awards?${query}`, { count: "exact" });
    return Response.json({ data, pagination: { page, pageSize, total: totalFromContentRange(response.headers.get("content-range")) } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
