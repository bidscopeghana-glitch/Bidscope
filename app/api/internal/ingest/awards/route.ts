import { apiErrorResponse } from "@/lib/server/api-error";
import { requireInternalSecret } from "@/lib/server/auth";
import { awardIngestBatchSchema } from "@/lib/server/schemas";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireInternalSecret(request);
    const input = awardIngestBatchSchema.parse(await request.json());
    const rows = input.records.map((item) => ({
      source_id: item.sourceId, source_key: item.sourceKey, opportunity_id: item.opportunityId ?? null,
      buyer_id: item.buyerId ?? null, country_code: item.countryCode, title: item.title,
      reference_number: item.referenceNumber ?? null, award_date: item.awardDate ?? null,
      currency: item.currency ?? null, award_value: item.awardValue ?? null,
      procurement_method: item.procurementMethod ?? null, source_url: item.sourceUrl,
      raw_payload: item.rawPayload, published_at: item.publishedAt ?? new Date().toISOString(),
    }));
    const { data: awards } = await supabaseRest<Array<{ id: string; source_key: string; country_code: string }>>("awards?on_conflict=country_code,source_key", {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(rows),
    });
    const awardByKey = new Map(awards.map((award) => [`${award.country_code}:${award.source_key}`, award.id]));
    const awardIds = awards.map((award) => award.id);
    if (awardIds.length) {
      await supabaseRest(`award_suppliers?award_id=in.(${awardIds.join(",")})`, { method: "DELETE" });
    }
    const supplierRows = input.records.flatMap((item) => {
      const awardId = awardByKey.get(`${item.countryCode}:${item.sourceKey}`);
      return awardId ? item.suppliers.map((supplier) => ({
        award_id: awardId, supplier_name: supplier.name, supplier_registration_number: supplier.registrationNumber ?? null,
        country_code: supplier.countryCode ?? null, awarded_value: supplier.awardedValue ?? null,
        is_joint_venture: supplier.isJointVenture, metadata: supplier.metadata,
      })) : [];
    });
    if (supplierRows.length) await supabaseRest("award_suppliers", { method: "POST", body: JSON.stringify(supplierRows) });
    return Response.json({ accepted: input.records.length, awards: awards.length, suppliers: supplierRows.length }, { status: 202 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
