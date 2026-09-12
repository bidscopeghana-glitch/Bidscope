import { apiErrorResponse } from "@/lib/server/api-error";
import { requireInternalSecret } from "@/lib/server/auth";
import { buyerIngestBatchSchema } from "@/lib/server/schemas";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireInternalSecret(request);
    const input = buyerIngestBatchSchema.parse(await request.json());
    const rows = input.records.map((item) => ({
      country_code: item.countryCode, name: item.name, slug: item.slug, entity_type: item.entityType ?? null,
      region: item.region ?? null, website: item.website ?? null, source_url: item.sourceUrl ?? null,
      description: item.description ?? null, contact: item.contact, metadata: item.metadata,
    }));
    const { data } = await supabaseRest<unknown[]>("procuring_entities?on_conflict=country_code,slug", {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(rows),
    });
    return Response.json({ accepted: input.records.length, data }, { status: 202 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

