import { ApiError } from "../api-error.ts";
import { supabaseRest, encodeFilter } from "../supabase-rest.ts";
import { normalize } from "../procurement/normalization.ts";
import { ingestNormalizedRecords } from "../procurement/ingestion.ts";
import { stableHash } from "../procurement/safety.ts";
import type { ProcurementSource } from "../procurement/types.ts";
import { reviewReason, type ExtractedDiscovery } from "./core.ts";

type DiscoveryRow = { id: string; source_id: string; canonical_url: string; content_hash: string; raw_text: string; extracted_data: ExtractedDiscovery; duplicate_status: string; matched_tender_id: string | null; processing_status: string; published_at: string | null };

async function audit(actor: string | null, action: string, id: string, metadata: Record<string, unknown> = {}) {
  await supabaseRest("audit_log", { method: "POST", body: JSON.stringify({ actor_user_id: actor, action, entity_type: "opportunity_discovery", entity_id: id, metadata }) });
}

async function discovery(id: string) {
  const { data } = await supabaseRest<DiscoveryRow[]>(`opportunity_discoveries?select=*&id=eq.${encodeFilter(id)}&limit=1`);
  if (!data[0]) throw new ApiError(404, "Discovery not found.");
  return data[0];
}

async function patch(id: string, values: Record<string, unknown>) {
  await supabaseRest(`opportunity_discoveries?id=eq.${encodeFilter(id)}`, { method: "PATCH", body: JSON.stringify({ ...values, updated_at: new Date().toISOString() }) });
}

export async function reviewDiscovery(id: string, action: "approve" | "reject" | "mark_unique" | "mark_duplicate" | "merge" | "edit" | "reextract", actor: string | null, payload: { matchId?: string; extracted?: Partial<ExtractedDiscovery> } = {}) {
  const row = await discovery(id);
  if (action === "edit") {
    if (row.processing_status === "published") throw new ApiError(409, "Published records cannot be edited here.");
    const allowed = ["title", "buyer", "reference", "description", "deadline", "published", "category", "documentUrls", "eligibility", "contactEmail"];
    const changes = Object.fromEntries(Object.entries(payload.extracted || {}).filter(([key]) => allowed.includes(key)));
    if (!Object.keys(changes).length) throw new ApiError(400, "No valid fields supplied.");
    await patch(id, { extracted_data: { ...row.extracted_data, ...changes }, processing_status: "needs_review", reviewed_by: actor, reviewed_at: new Date().toISOString() });
    await audit(actor, "discovery.edited", id, { fields: Object.keys(changes) });
    return { status: "needs_review" };
  }
  if (action === "reextract") {
    const { extractDiscovery } = await import("./core.ts");
    const extracted = extractDiscovery({ url: row.canonical_url, status: "completed", markdown: row.raw_text });
    await patch(id, { extracted_data: extracted, confidence_score: extracted.confidence, processing_status: "needs_review", reviewed_by: actor, reviewed_at: new Date().toISOString() });
    await audit(actor, "discovery.reextracted", id);
    return { status: "needs_review" };
  }
  if (action === "reject") {
    if (row.processing_status === "published") throw new ApiError(409, "Published tender must be managed in the tender record.");
    await patch(id, { processing_status: "rejected", reviewed_by: actor, reviewed_at: new Date().toISOString() });
    await audit(actor, "discovery.rejected", id);
    return { status: "rejected" };
  }
  if (action === "mark_unique" || action === "mark_duplicate") {
    await patch(id, { duplicate_status: action === "mark_unique" ? "manually_confirmed_unique" : "manually_confirmed_duplicate", matched_tender_id: action === "mark_unique" ? null : row.matched_tender_id, reviewed_by: actor, reviewed_at: new Date().toISOString() });
    await audit(actor, `discovery.${action}`, id);
    return { status: "needs_review" };
  }
  const { data: sources } = await supabaseRest<ProcurementSource[]>(`procurement_sources?select=*&id=eq.${row.source_id}&limit=1`);
  const source = sources[0] as ProcurementSource & { discovery_enabled?: boolean; crawl_robots_allowed?: boolean; crawl_terms_reviewed?: boolean };
  if (!source?.discovery_enabled || !source.crawl_robots_allowed || !source.crawl_terms_reviewed) throw new ApiError(409, "Source is not approved for discovery.");
  if (action === "merge") {
    const target = payload.matchId || row.matched_tender_id;
    if (!target) throw new ApiError(400, "Select a tender to merge with.");
    const { data: tenders } = await supabaseRest<Array<{ id: string }>>(`procurement_opportunities?select=id&id=eq.${encodeFilter(target)}&limit=1`);
    if (!tenders[0]) throw new ApiError(404, "Matching tender not found.");
    await supabaseRest("opportunity_sources?on_conflict=source_id,external_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ opportunity_id: target, source_id: row.source_id, external_id: row.extracted_data.reference || stableHash(row.canonical_url), official_url: row.canonical_url, is_preferred: false, last_verified_at: new Date().toISOString() }) });
    await patch(id, { processing_status: "published", duplicate_status: "manually_confirmed_duplicate", matched_tender_id: target, reviewed_by: actor, reviewed_at: new Date().toISOString(), published_at: new Date().toISOString() });
    await audit(actor, "discovery.merged", id, { target });
    return { status: "merged", tenderId: target };
  }
  if (row.processing_status === "published") return { status: "published", tenderId: row.matched_tender_id };
  if (["exact_duplicate", "probable_duplicate", "possible_duplicate", "manually_confirmed_duplicate"].includes(row.duplicate_status)) throw new ApiError(409, "Resolve the possible duplicate or merge it before publishing.");
  const issue = reviewReason(row.extracted_data);
  if (issue) throw new ApiError(409, issue);
  const extracted = row.extracted_data;
  const record = normalize({
    title: extracted.title!, buyer_name: extracted.buyer!, country: source.country_code === "GH" ? "Ghana" : source.country_code,
    country_code: source.country_code, source_name: source.name, source_type: "EXTERNAL",
    official_source_url: row.canonical_url, official_tender_url: row.canonical_url,
    external_reference: extracted.reference, external_opportunity_id: extracted.reference || stableHash(row.canonical_url),
    description: extracted.description || "", summary: extracted.description?.slice(0, 900) || "",
    deadline_at: extracted.deadline, published_at: extracted.published || null, category: extracted.category || "other",
    documents_url: extracted.documentUrls?.[0] || null, eligibility_text: extracted.eligibility,
    contact_email: extracted.contactEmail, data_confidence: source.trust_level === "OFFICIAL" || source.trust_level === "VERIFIED_OFFICIAL" ? "OFFICIAL_SOURCE" : "PUBLIC_SOURCE",
    verification_status: "NEEDS_REVIEW", raw_source_hash: row.content_hash,
    raw_payload: { discovery_id: id, source_published_at: extracted.published, source_url: row.canonical_url },
  });
  const result = await ingestNormalizedRecords(source, [record], actor || undefined);
  if (result.failed || (!result.inserted && !result.duplicates && !result.updated)) throw new ApiError(503, "Tender publication failed; discovery remains in review.");
  const { data: tender } = await supabaseRest<Array<{ opportunity_id: string }>>(`opportunity_sources?select=opportunity_id&source_id=eq.${source.id}&external_id=eq.${encodeFilter(record.external_opportunity_id || stableHash(row.canonical_url))}&limit=1`);
  if (!tender[0]) throw new ApiError(503, "Tender was ingested but could not be linked to discovery.");
  await patch(id, { processing_status: "published", matched_tender_id: tender[0].opportunity_id, published_at: new Date().toISOString(), reviewed_by: actor, reviewed_at: new Date().toISOString() });
  await audit(actor, "discovery.published", id, { tender_id: tender[0].opportunity_id, inserted: result.inserted, duplicates: result.duplicates });
  return { status: "published", tenderId: tender[0].opportunity_id };
}
