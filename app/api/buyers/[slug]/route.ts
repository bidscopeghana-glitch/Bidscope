import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { supabaseRest } from "@/lib/server/supabase-rest";
import { canViewTenderSource } from "@/lib/server/tender-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const access=await canViewTenderSource(request);
    if(!access.allowed)throw new ApiError(402,"Buyer intelligence requires an active BidScope subscription.","subscription_required");
    const { slug } = await context.params;
    const buyerQuery = new URLSearchParams({ select: "id,country_code,name,slug,entity_type,region,website,source_url,description,contact,created_at,updated_at", slug: `eq.${slug.slice(0, 220)}`, limit: "1" });
    const { data: buyers } = await supabaseRest<Array<{ id: string } & Record<string, unknown>>>(`procuring_entities?${buyerQuery}`);
    if (!buyers.length) throw new ApiError(404, "Government buyer not found.", "not_found");
    const buyer = buyers[0];
    const opportunitiesQuery = new URLSearchParams({ select: "id,slug,title,category,deadline,status,source_url", buyer_id: `eq.${buyer.id}`, published_at: "not.is.null", order: "publication_date.desc", limit: "20" });
    const awardsQuery = new URLSearchParams({ select: "id,title,reference_number,award_date,currency,award_value,source_url,suppliers:award_suppliers(id,supplier_name,supplier_registration_number,country_code,awarded_value,is_joint_venture)", buyer_id: `eq.${buyer.id}`, published_at: "not.is.null", order: "award_date.desc", limit: "20" });
    const [{ data: opportunities }, { data: awards }] = await Promise.all([
      supabaseRest<unknown[]>(`opportunities?${opportunitiesQuery}`),
      supabaseRest<unknown[]>(`awards?${awardsQuery}`),
    ]);
    return Response.json({ data: { ...buyer, opportunities, awards } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
