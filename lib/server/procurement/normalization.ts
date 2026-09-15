import { parseDate, slugify, stableHash, stripImportedHtml } from "./safety.ts";
import type { NormalizedOpportunity } from "./types.ts";

export function text(value: unknown, maximum = 10_000) {
  return stripImportedHtml(typeof value === "string" ? value : "", maximum);
}

export function firstDate(...values: unknown[]) {
  for (const value of values) { const parsed = parseDate(value); if (parsed) return parsed; }
  return null;
}

export function opportunityStatus(input: { publishedAt?: string | null; deadlineAt?: string | null; stage?: string | null }, now = new Date()) {
  const stage = (input.stage || "").toLowerCase();
  if (/award/.test(stage)) return "AWARDED" as const;
  if (/cancel|withdraw/.test(stage)) return "CANCELLED" as const;
  if (/forecast|plan|prior information|general procurement/.test(stage)) return "UPCOMING" as const;
  if (!input.deadlineAt) return "UNKNOWN" as const;
  const deadline = new Date(input.deadlineAt);
  if (Number.isNaN(deadline.valueOf())) return "UNKNOWN" as const;
  if (deadline < now) return "CLOSED" as const;
  if (deadline.valueOf() - now.valueOf() <= 7 * 86_400_000) return "CLOSING_SOON" as const;
  return "OPEN" as const;
}

export function eligibility(textValue: string | null | undefined, countryCode: string) {
  const value = (textValue || "").toLowerCase();
  if (/ghanaian (only|owned)|citizens? of ghana|registered in ghana only|\bnational competitive/.test(value)) return { status: "GHANA_ELIGIBLE" as const, summary: "Restricted to Ghanaian or nationally eligible suppliers." };
  if (/international competitive|open to all|all eligible countries|worldwide|foreign bidders/.test(value)) return { status: "INTERNATIONAL_ELIGIBLE" as const, summary: "International competition is indicated by the official notice." };
  if (/restricted|shortlist|invited bidders|prequalified/.test(value)) return { status: "RESTRICTED" as const, summary: "Participation appears restricted; check the official notice." };
  return { status: countryCode === "GH" ? "GHANA_ELIGIBLE" as const : "UNCLEAR" as const, summary: countryCode === "GH" ? "Ghana-based opportunity; verify tender-specific eligibility." : "Eligibility is not explicit; verify the official notice before bidding." };
}

export type OpportunityInput = Partial<NormalizedOpportunity> & Pick<NormalizedOpportunity, "title" | "buyer_name" | "country" | "country_code" | "source_name" | "source_type" | "official_source_url">;

export function normalize(input: OpportunityInput): NormalizedOpportunity {
  const now = new Date().toISOString();
  const externalId = input.external_opportunity_id || input.external_reference || stableHash([input.source_name, input.title, input.buyer_name, input.deadline_at]).slice(0, 24);
  const title = text(input.title, 500) || "Untitled procurement opportunity";
  const eligibilityResult = eligibility(input.eligibility_text, input.country_code);
  const status = input.status || opportunityStatus({ publishedAt: input.published_at, deadlineAt: input.deadline_at, stage: input.contract_type });
  const qualitySignals = [input.summary || input.description, input.deadline_at, input.external_reference, input.procurement_method, input.category, input.documents_url, input.contact_email || input.contact_phone, input.eligibility_text, input.submission_instructions, input.qualification_requirements, input.bid_security_requirement, input.procurement_codes?.length ? input.procurement_codes : null].filter(Boolean).length;
  return {
    bidscope_reference: input.bidscope_reference || `BS-${slugify(input.source_name).slice(0, 8).toUpperCase()}-${String(externalId).replace(/[^a-z0-9]/gi, "").slice(-18).toUpperCase()}`,
    slug: input.slug || `${slugify(title)}-${stableHash([input.source_name, externalId]).slice(0, 10)}`,
    title, summary: text(input.summary || input.description, 1_000), description: text(input.description, 50_000), buyer_name: text(input.buyer_name, 400), buyer_type: input.buyer_type || null,
    country: input.country, country_code: input.country_code, region: input.region || null, sector: input.sector || null, category: input.category || "other", subcategory: input.subcategory || null,
    procurement_method: input.procurement_method || null, contract_type: input.contract_type || null, currency: input.currency || null, estimated_value: input.estimated_value || null, minimum_value: input.minimum_value || null, maximum_value: input.maximum_value || null,
    published_at: input.published_at || null, deadline_at: input.deadline_at || null, status,
    notice_stage: input.notice_stage || (status === "UPCOMING" ? "PLANNED" : status === "AWARDED" ? "AWARD" : status === "OPEN" || status === "CLOSING_SOON" ? "OPEN" : "OTHER"),
    source_name: input.source_name, source_type: input.source_type, external_opportunity_id: String(externalId), external_reference: input.external_reference || null, source_resource_id: input.source_resource_id || null,
    official_source_url: input.official_source_url, official_tender_url: input.official_tender_url || input.official_source_url, official_submission_url: input.official_submission_url || null, submission_platform: input.submission_platform || null, submission_method: input.submission_method || null,
    requires_registration: input.requires_registration || false, registration_url: input.registration_url || null, funding_source: input.funding_source || "Other", funding_agency: input.funding_agency || null,
    eligibility_text: input.eligibility_text || null, eligibility_country: input.eligibility_country || null, eligibility_status: input.eligibility_status || eligibilityResult.status, eligibility_summary: input.eligibility_summary || eligibilityResult.summary,
    documents_url: input.documents_url || null, contact_name: input.contact_name || null, contact_email: input.contact_email || null, contact_phone: input.contact_phone || null,
    contact_address: input.contact_address || null, opening_at: input.opening_at || null, clarification_deadline_at: input.clarification_deadline_at || null,
    bid_validity_days: input.bid_validity_days || null, participation_fee_amount: input.participation_fee_amount || null, participation_fee_currency: input.participation_fee_currency || null,
    bid_security_requirement: input.bid_security_requirement || null, procurement_codes: input.procurement_codes || [], lots: input.lots || [],
    submission_instructions: input.submission_instructions || null, qualification_requirements: input.qualification_requirements || null, source_details: input.source_details || {},
    quality_score: input.quality_score ?? Math.min(100, 40 + qualitySignals * 5), rejection_reason: input.rejection_reason || null,
    last_source_update: input.last_source_update || null, last_verified_at: input.last_verified_at || now, data_confidence: input.data_confidence || "OFFICIAL_SOURCE", verification_status: input.verification_status || "OFFICIAL",
    raw_source_hash: input.raw_source_hash || stableHash(input.raw_payload || input), document_fingerprint: input.document_fingerprint || stableHash([input.source_name, input.external_reference, title, input.deadline_at]), raw_payload: input.raw_payload || {},
  };
}
