import { apiErrorResponse } from "@/lib/server/api-error";
import { pagination, safeSearchTerm, totalFromContentRange } from "@/lib/server/query";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const incoming = new URL(request.url).searchParams;
    const { page, pageSize, offset } = pagination(incoming);
    const query = new URLSearchParams({
      select: "id,slug,reference_number,title,summary,category,sectors,procurement_method,region,currency,estimated_value,publication_date,deadline,status,source_url,published_at,buyer:procuring_entities(id,name,slug,entity_type,region)",
      published_at: "not.is.null",
      status: incoming.get("status") === "closed" ? "eq.closed" : "eq.open",
      country_code: `eq.${(incoming.get("country") || "GH").slice(0, 2).toUpperCase()}`,
      order: incoming.get("sort") === "newest" ? "publication_date.desc.nullslast" : "deadline.asc.nullslast",
      limit: String(pageSize),
      offset: String(offset),
    });
    const category = incoming.get("category");
    const region = incoming.get("region");
    const sector = incoming.get("sector");
    const buyer = incoming.get("buyer");
    const search = safeSearchTerm(incoming.get("q"));
    if (category) query.set("category", `eq.${category.toLowerCase()}`);
    if (region) query.set("region", `ilike.${region.slice(0, 120).replace(/[%_*,()]/g, " ")}`);
    if (sector) query.set("sectors", `cs.{${sector.slice(0, 80).replace(/[{},]/g, "")}}`);
    if (buyer) query.set("buyer_id", `eq.${buyer}`);
    if (search) query.set("or", `(title.ilike.*${search}*,summary.ilike.*${search}*,reference_number.ilike.*${search}*)`);

    const { data, response } = await supabaseRest<unknown[]>(`opportunities?${query}`, { count: "exact" });
    return Response.json({ data, pagination: { page, pageSize, total: totalFromContentRange(response.headers.get("content-range")) } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
