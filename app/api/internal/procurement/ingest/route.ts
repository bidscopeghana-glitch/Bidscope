import { apiErrorResponse } from "@/lib/server/api-error";
import { requireInternalSecret } from "@/lib/server/auth";
import { canonicalOpportunityBatchSchema } from "@/lib/server/schemas";
import { slugify, stableHash, stripImportedHtml } from "@/lib/server/procurement/safety";
import { ingestNormalizedRecords } from "@/lib/server/procurement/ingestion";
import type { NormalizedOpportunity, ProcurementSource } from "@/lib/server/procurement/types";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireInternalSecret(request);
    const input = canonicalOpportunityBatchSchema.parse(await request.json());
    const slugs = [...new Set(input.records.map((record) => record.sourceSlug))];
    const results = [];
    for (const slug of slugs) {
      const { data } = await supabaseRest<ProcurementSource[]>(`procurement_sources?select=*&slug=eq.${encodeURIComponent(slug)}&limit=1`);
      const source = data[0];
      if (!source) throw new Error(`Unknown source: ${slug}`);
      const normalized: NormalizedOpportunity[] = input.records.filter((record) => record.sourceSlug === slug).map((record) => {
        const title = stripImportedHtml(record.title, 500);
        const hash = stableHash(record.rawPayload);
        const deadline = record.deadlineAt || null;
        return {
          bidscope_reference: `BS-${source.slug.toUpperCase().slice(0, 8)}-${(record.externalOpportunityId || hash).replace(/[^a-z0-9]/gi, "").slice(0, 16).toUpperCase()}`,
          slug: `${slugify(title)}-${slugify(record.externalOpportunityId || hash.slice(0, 10))}`,
          title, summary: stripImportedHtml(record.summary, 3000), description: stripImportedHtml(record.description),
          buyer_name: stripImportedHtml(record.buyerName, 300), buyer_type: record.buyerType || null,
          country: record.country, country_code: record.countryCode, region: record.region || null, sector: record.sector || null,
          category: record.category, subcategory: record.subcategory || null, procurement_method: record.procurementMethod || null,
          contract_type: record.contractType || null, currency: record.currency || null, estimated_value: record.estimatedValue ?? null,
          minimum_value: record.minimumValue ?? null, maximum_value: record.maximumValue ?? null, published_at: record.publishedAt || null,
          deadline_at: deadline, status: deadline && new Date(deadline) < new Date() && record.status === "OPEN" ? "CLOSED" : record.status,
          source_name: source.name, source_type: source.integration_type, external_opportunity_id: record.externalOpportunityId || null,
          external_reference: record.externalReference || null, source_resource_id: record.sourceResourceId || null,
          official_source_url: record.officialSourceUrl, official_tender_url: record.officialTenderUrl || record.officialSourceUrl,
          official_submission_url: record.officialSubmissionUrl || null, submission_platform: record.submissionPlatform || null,
          submission_method: record.submissionMethod || null, requires_registration: record.requiresRegistration,
          registration_url: record.registrationUrl || null, funding_source: record.fundingSource, funding_agency: record.fundingAgency || null,
          eligibility_text: record.eligibilityText || null, eligibility_country: record.eligibilityCountry || null,
          documents_url: record.documentsUrl || null, contact_name: record.contactName || null, contact_email: record.contactEmail || null,
          contact_phone: record.contactPhone || null, last_source_update: new Date().toISOString(), last_verified_at: new Date().toISOString(),
          data_confidence: source.trust_level === "VERIFIED_OFFICIAL" ? "VERIFIED_OFFICIAL_SOURCE" : source.trust_level === "OFFICIAL" ? "OFFICIAL_SOURCE" : source.trust_level === "PUBLIC" ? "PUBLIC_SOURCE" : "NEEDS_REVIEW",
          verification_status: source.trust_level === "VERIFIED_OFFICIAL" ? "VERIFIED" : source.trust_level === "OFFICIAL" ? "OFFICIAL" : "NEEDS_REVIEW",
          raw_source_hash: hash, document_fingerprint: stableHash([record.externalReference, title, deadline, record.estimatedValue]), raw_payload: record.rawPayload,
        };
      });
      results.push({ source: slug, ...(await ingestNormalizedRecords(source, normalized)) });
    }
    return Response.json({ results }, { status: 202 });
  } catch (error) { return apiErrorResponse(error); }
}

