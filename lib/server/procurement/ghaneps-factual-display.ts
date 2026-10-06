/**
 * Live GHANEPS HTML notices are not the separately licensed OCDS dataset.
 * Show independently stated facts and official links without returning indexed
 * source prose, attachments, or raw HTML to customer-facing endpoints.
 */
export function ghanepsFactualDisplay<T extends object>(record: T): T {
  const value = record as Record<string, unknown>;
  if (value.source_name !== "GHANEPS" || value.source_type !== "STRUCTURED_WEB") return record;

  const officialLink = (candidate: unknown) => {
    if (typeof candidate !== "string") return null;
    try {
      const url = new URL(candidate);
      return url.protocol === "https:" && (url.hostname === "ghaneps.gov.gh" || url.hostname === "www.ghaneps.gov.gh")
        ? url.toString() : null;
    } catch { return null; }
  };
  const sourceUrl = officialLink(value.official_source_url) || "https://www.ghaneps.gov.gh/epps/viewCFTSAction.do";

  return {
    id: value.id,
    slug: value.slug,
    title: value.title,
    summary: "Public GHANEPS tender. Review the official notice for the full scope, eligibility and submission requirements.",
    description: "BidScope lists key facts for discovery. The complete tender notice and documents remain on GHANEPS.",
    buyer_name: value.buyer_name,
    country: value.country,
    country_code: value.country_code,
    region: value.region,
    sector: value.sector,
    category: value.category,
    published_at: value.published_at,
    deadline_at: value.deadline_at,
    opening_at: value.opening_at,
    status: value.status,
    source_name: value.source_name,
    source_type: value.source_type,
    external_reference: value.external_reference,
    procurement_method: value.procurement_method,
    contract_type: value.contract_type,
    estimated_value: value.estimated_value,
    currency: value.currency,
    official_source_url: sourceUrl,
    official_tender_url: officialLink(value.official_tender_url) || sourceUrl,
    official_submission_url: officialLink(value.official_submission_url) || sourceUrl,
    documents_url: officialLink(value.documents_url),
    requires_registration: value.requires_registration,
    registration_url: officialLink(value.registration_url),
    submission_platform: value.submission_platform,
    verification_status: value.verification_status,
    last_verified_at: value.last_verified_at,
    match: value.match,
    saved: value.saved,
    source_details: {},
  } as T;
}
