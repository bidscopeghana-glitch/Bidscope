import { apiErrorResponse } from "@/lib/server/api-error";
import { requireInternalSecret } from "@/lib/server/auth";
import { opportunityIngestBatchSchema } from "@/lib/server/schemas";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

function databaseRow(record: ReturnType<typeof opportunityIngestBatchSchema.parse>["records"][number], sourceId: string) {
  return {
    source_id: sourceId, source_key: record.sourceKey, country_code: record.countryCode, slug: record.slug,
    reference_number: record.referenceNumber ?? null, title: record.title, summary: record.summary,
    description: record.description, category: record.category, sectors: record.sectors,
    procurement_method: record.procurementMethod ?? null, buyer_id: record.buyerId ?? null, region: record.region ?? null,
    currency: record.currency ?? null, estimated_value: record.estimatedValue ?? null,
    publication_date: record.publicationDate ?? null, deadline: record.deadline ?? null, status: record.status,
    source_url: record.sourceUrl, source_document_url: record.sourceDocumentUrl ?? null,
    eligibility: record.eligibility ?? null, contact: record.contact, raw_payload: record.rawPayload,
    content_hash: record.contentHash ?? null, published_at: record.publishedAt ?? new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  let runId: string | null = null;
  try {
    requireInternalSecret(request);
    const input = opportunityIngestBatchSchema.parse(await request.json());
    const { data: runs } = await supabaseRest<Array<{ id: string }>>("ingestion_runs", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ source_id: input.sourceId, discovered_count: input.records.length }),
    });
    runId = runs[0]?.id || null;
    const { data } = await supabaseRest<unknown[]>("opportunities?on_conflict=country_code,source_key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(input.records.map((record) => databaseRow(record, input.sourceId))),
    });
    if (runId) {
      await supabaseRest(`ingestion_runs?id=eq.${runId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "succeeded", completed_at: new Date().toISOString(), inserted_count: data.length }),
      });
    }
    await supabaseRest("ingestion_sources?id=eq." + input.sourceId, {
      method: "PATCH", body: JSON.stringify({ last_success_at: new Date().toISOString() }),
    });
    return Response.json({ accepted: input.records.length, runId }, { status: 202 });
  } catch (error) {
    if (runId) {
      await supabaseRest(`ingestion_runs?id=eq.${runId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "failed", completed_at: new Date().toISOString(), error_summary: error instanceof Error ? error.message.slice(0, 1000) : "Unknown ingestion error" }),
      }).catch(() => undefined);
    }
    return apiErrorResponse(error);
  }
}

