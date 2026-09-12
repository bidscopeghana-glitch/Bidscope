import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const query = new URLSearchParams({
      select: "id,slug,reference_number,title,summary,description,category,sectors,procurement_method,region,currency,estimated_value,publication_date,deadline,status,source_url,source_document_url,eligibility,contact,published_at,buyer:procuring_entities(id,name,slug,entity_type,region,website,source_url),documents:opportunity_documents(id,title,document_type,url,mime_type,size_bytes)",
      slug: `eq.${slug.slice(0, 220)}`,
      published_at: "not.is.null",
      status: "neq.draft",
      limit: "1",
    });
    const { data } = await supabaseRest<unknown[]>(`opportunities?${query}`);
    if (!data.length) throw new ApiError(404, "Opportunity not found.", "not_found");
    return Response.json({ data: data[0] });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
