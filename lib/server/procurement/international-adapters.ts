import { z } from "zod";
import { firstDate, normalize, text } from "./normalization.ts";
import { enforceSourceRateLimit, fetchWithRetry } from "./safety.ts";
import type { AdapterHealth, NormalizedOpportunity, ProcurementSourceAdapter } from "./types.ts";
import { extractOfficialPdfText } from "./ghana-adapters.ts";

type Raw = Record<string, unknown>;
const RecordSchema = z.record(z.string(), z.unknown());
const ArrayRecordSchema = z.array(RecordSchema);

function nested(record: Raw, path: string) { return path.split(".").reduce<unknown>((value, key) => value && typeof value === "object" ? (value as Raw)[key] : undefined, record); }
function strings(value: unknown): string[] { if (typeof value === "string") return [value]; if (Array.isArray(value)) return value.flatMap(strings); if (value && typeof value === "object") return Object.values(value as Raw).flatMap(strings); return []; }
function pick(record: Raw, ...paths: string[]) { for (const path of paths) { const value = strings(nested(record, path)).find(Boolean); if (value) return value; } return null; }

function isWebUrl(value: string | null): value is string {
  if (!value) return false;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}

function linkHref(value: unknown, relation?: string) {
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const link = item as Raw;
    if (relation && String(link.rel || "").toLowerCase() !== relation) continue;
    const href = typeof link.href === "string" ? link.href : typeof link.url === "string" ? link.url : null;
    if (isWebUrl(href)) return href;
  }
  return null;
}
function object(value: unknown): Raw { return value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {}; }
function arrayObjects(value: unknown) { return Array.isArray(value) ? value.filter((item): item is Raw => Boolean(item && typeof item === "object" && !Array.isArray(item))) : []; }
function numeric(value: unknown) { const number = Number(value); return Number.isFinite(number) ? number : null; }
async function mapLimited<T, R>(values: T[], concurrency: number, mapper: (value: T) => Promise<R>) {
  const output = new Array<R>(values.length); let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => { while (cursor < values.length) { const index = cursor++; output[index] = await mapper(values[index]); } }));
  return output;
}
function tedDocumentUrl(raw: Raw) {
  const candidates = strings(raw.links).filter(isWebUrl);
  return candidates.find((url) => /(?:\/pdf|\.pdf)(?:$|\?)/i.test(url)) || candidates.find((url) => /ted\.europa\.eu/i.test(url)) || null;
}

/** Resolve a browser-facing notice page, never a bulk OCDS search endpoint. */
export function ocdsNoticeUrl(raw: Raw, config: OcdsConfig) {
  const tender = raw.tender && typeof raw.tender === "object" ? raw.tender as Raw : {};
  const documentUrls = Array.isArray(tender.documents)
    ? tender.documents.flatMap((document) => document && typeof document === "object" ? strings((document as Raw).url) : [])
    : [];
  const noticeDocument = documentUrls.find((url) => isWebUrl(url) && /\/(?:notice|notices)\//i.test(url));
  if (noticeDocument) return noticeDocument;

  if (config.slug === "uk-find-a-tender") {
    const releaseId = String(raw.id || "");
    if (/^\d{6}-\d{4}$/.test(releaseId)) return `https://www.find-tender.service.gov.uk/Notice/${encodeURIComponent(releaseId)}`;
  }
  const linked = pick(raw, "links.tender", "links.self", "url")
    || linkHref(raw.links, "tender")
    || linkHref(raw.links, "canonical");
  if (isWebUrl(linked) && !/\/(?:api|published)\//i.test(new URL(linked).pathname)) return linked;

  if (config.slug === "uk-contracts-finder") {
    const releaseId = String(raw.id || "").match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:-|$)/i)?.[1];
    if (releaseId) return `https://www.contractsfinder.service.gov.uk/Notice/${releaseId}`;
  }
  return config.endpoint;
}

abstract class JsonAdapter implements ProcurementSourceAdapter<Raw> {
  abstract readonly slug: string; abstract fetchOpportunities(): Promise<Raw[]>; abstract normaliseOpportunity(raw: Raw): Promise<NormalizedOpportunity>; abstract getOfficialUrl(raw: Raw): string;
  getSubmissionUrl() { return null; }
  async fetchOpportunityById(id: string) { return (await this.fetchOpportunities()).find((row) => String(row.id || row.ocid || row["publication-number"]) === id) || null; }
  async healthCheck(): Promise<AdapterHealth> { try { const rows = await this.fetchOpportunities(); return { ok: true, message: `Official API connected; ${rows.length} records validated.`, checkedAt: new Date().toISOString() }; } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "API check failed", checkedAt: new Date().toISOString() }; } }
}

export class TedAdapter extends JsonAdapter {
  readonly slug = "ted-eu"; private endpoint = "https://api.ted.europa.eu/v3/notices/search";
  async fetchOpportunities() {
    enforceSourceRateLimit(this.slug, 20);
    const since = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10).replaceAll("-", "");
    const response = await fetchWithRetry(this.endpoint, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "BidScopeGhana/1.0" }, body: JSON.stringify({ query: `publication-date >= ${since}`, page: 1, limit: 100, paginationMode: "PAGE_NUMBER", fields: ["publication-number", "notice-title", "buyer-name", "publication-date", "deadline-receipt-tender-date-lot", "deadline-receipt-request", "classification-cpv", "place-of-performance-country-proc", "procedure-type", "form-type"] }) });
    const payload = RecordSchema.parse(await response.json()); const rows = ArrayRecordSchema.parse(payload.notices || payload.results || []);
    return mapLimited(rows, 4, async (row) => {
      const documentUrl = tedDocumentUrl(row);
      if (!documentUrl || !/(?:\/pdf|\.pdf)(?:$|\?)/i.test(documentUrl)) return { ...row, documentUrl };
      const noticeText = await extractOfficialPdfText(documentUrl).catch(() => "");
      return { ...row, documentUrl, noticeText };
    });
  }
  async normaliseOpportunity(raw: Raw) { const id = pick(raw, "publication-number") || "ted"; const title = pick(raw, "notice-title") || "European public procurement opportunity"; const countries = strings(raw["place-of-performance-country-proc"]); const noticeText = text(raw.noticeText, 50_000); const eligibilityText = noticeText || "Published through TED. Ghanaian supplier eligibility is not assumed; review participation, qualification and place-of-performance requirements in the official notice."; const documentUrl = text(raw.documentUrl) || tedDocumentUrl(raw); return normalize({ title, summary: noticeText.slice(0, 1_000), description: noticeText, buyer_name: pick(raw, "buyer-name") || "European public authority", country: countries.join(", ") || "European Union", country_code: countries[0]?.length === 2 ? countries[0] : "EU", sector: strings(raw["classification-cpv"]).join(", ") || null, procurement_method: pick(raw, "procedure-type"), contract_type: pick(raw, "form-type"), published_at: firstDate(pick(raw, "publication-date")), deadline_at: firstDate(pick(raw, "deadline-receipt-tender-date-lot"), pick(raw, "deadline-receipt-request")), source_name: "Tenders Electronic Daily", source_type: "OPEN_API", external_opportunity_id: id, external_reference: id, official_source_url: this.getOfficialUrl(raw), official_tender_url: this.getOfficialUrl(raw), documents_url: documentUrl, funding_source: "European public procurement", eligibility_text: eligibilityText, eligibility_status: "UNCLEAR", eligibility_summary: "International eligibility is unconfirmed; check the official TED notice.", source_details: { officialDocument: documentUrl, extraction: noticeText ? "Official TED notice PDF" : "TED structured notice" }, raw_payload: raw }); }
  getOfficialUrl(raw: Raw) { const id = pick(raw, "publication-number") || ""; return `https://ted.europa.eu/en/notice/-/detail/${encodeURIComponent(id)}`; }
}

type OcdsConfig = { slug: string; name: string; endpoint: string; country: string; countryCode: string };
export class OcdsAdapter extends JsonAdapter {
  readonly slug: string; private config: OcdsConfig;
  constructor(config: OcdsConfig) { super(); this.slug = config.slug; this.config = config; }
  async fetchOpportunities() {
    enforceSourceRateLimit(this.slug, 20); const url = new URL(this.config.endpoint); const now = new Date(); const from = new Date(now.valueOf() - 14 * 86_400_000).toISOString();
    url.searchParams.set("limit", "100"); url.searchParams.set("stages", "tender");
    if (this.slug === "uk-contracts-finder") { url.searchParams.set("publishedFrom", from); url.searchParams.set("publishedTo", now.toISOString()); }
    else { url.searchParams.set("updatedFrom", from); url.searchParams.set("updatedTo", now.toISOString()); }
    const response = await fetchWithRetry(url.toString(), { headers: { Accept: "application/json", "User-Agent": "BidScopeGhana/1.0" } }); const payload = RecordSchema.parse(await response.json());
    const packages = Array.isArray(payload.releases) ? payload.releases : Array.isArray(payload.releasePackages) ? payload.releasePackages : [];
    return packages.flatMap((item) => { if (!item || typeof item !== "object") return []; const record = item as Raw; if (Array.isArray(record.releases)) return record.releases.filter((release): release is Raw => Boolean(release && typeof release === "object")); return [record]; });
  }
  async normaliseOpportunity(raw: Raw) {
    const tender = object(raw.tender); const id = String(raw.ocid || raw.id || tender.id || "ocds"); const title = text(tender.title || raw.title || "UK public procurement opportunity", 500); const buyer = object(raw.buyer);
    const parties = arrayObjects(raw.parties); const buyerParty = parties.find((party) => Array.isArray(party.roles) && party.roles.includes("buyer")) || parties.find((party) => String(party.id) === String(buyer.id)) || {};
    const contact = object(buyerParty.contactPoint); const address = object(buyerParty.address); const value = object(tender.value); const lots = arrayObjects(tender.lots); const items = arrayObjects(tender.items);
    const documents = arrayObjects(tender.documents); const documentUrl = documents.map((document) => pick(document, "url")).find(isWebUrl) || null;
    const lotDescriptions = lots.map((lot) => text(lot.description, 8_000)).filter(Boolean); const generalDescription = text(raw.description, 8_000);
    const description = [text(tender.description, 20_000), ...lotDescriptions, generalDescription].filter(Boolean).filter((part,index,all)=>all.indexOf(part)===index).join("\n\n");
    const suitability = object(tender.suitability); const eligibilityText = [text(tender.eligibilityCriteria || ""), suitability.sme === true ? "Suitable for small and medium-sized enterprises." : "", suitability.vcse === true ? "Suitable for voluntary, community and social enterprises." : ""].filter(Boolean).join(" ");
    const submissionTerms = object(tender.submissionTerms); const validity = numeric(object(submissionTerms.bidValidityPeriod).durationInDays); const submissionDetails = text(tender.submissionMethodDetails || generalDescription, 3_000) || null;
    const classifications = [object(tender.classification), ...items.flatMap((item) => arrayObjects(item.additionalClassifications))].map((item) => String(item.id || "")).filter(Boolean);
    const official = this.getOfficialUrl(raw);
    const buyerDetails = object(buyerParty.details); const buyerClassifications = arrayObjects(buyerDetails.classifications).map((item) => text(item.description || item.id, 200)).filter(Boolean);
    return normalize({ title, summary: text(tender.description, 1_000), description, buyer_name: text(buyer.name || buyerParty.name || "UK public authority", 400), buyer_type: buyerClassifications.join(", ") || null, country: this.config.country, country_code: this.config.countryCode, category: /works/i.test(String(tender.mainProcurementCategory)) ? "works" : /goods/i.test(String(tender.mainProcurementCategory)) ? "goods" : /services/i.test(String(tender.mainProcurementCategory)) ? "services" : "other", procurement_method: text(tender.procurementMethodDetails || tender.procurementMethod) || null, contract_type: text(tender.mainProcurementCategory) || null, currency: text(value.currency,3)||null, estimated_value: numeric(value.amount), published_at: firstDate(raw.date, tender.datePublished), deadline_at: firstDate(nested(tender, "tenderPeriod.endDate")), opening_at: firstDate(nested(tender,"bidOpening.date")), source_name: this.config.name, source_type: "OPEN_API", external_opportunity_id: id, external_reference: String(tender.id || id), official_source_url: official, official_tender_url: official, official_submission_url: isWebUrl(submissionDetails) ? submissionDetails : null, submission_platform: Array.isArray(tender.submissionMethod)&&tender.submissionMethod.includes("electronicSubmission")?"Electronic submission":"Official buyer portal", submission_method: text(tender.submissionMethodDetails || (Array.isArray(tender.submissionMethod)?tender.submissionMethod.join(", "):""),2_000)||null, submission_instructions: submissionDetails, documents_url: documentUrl || official, funding_source: "United Kingdom public procurement", eligibility_text: eligibilityText || null, eligibility_status: "UNCLEAR", eligibility_summary: "No assumption of Ghanaian eligibility; inspect the official participation rules.", contact_name: text(contact.name,300)||null, contact_email: text(contact.email,320)||null, contact_phone: text(contact.telephone,100)||null, contact_address: [address.streetAddress,address.locality,address.postalCode,address.countryName].filter(Boolean).join(", ")||null, bid_validity_days: validity, procurement_codes: classifications, lots, source_details: { suitability, contractPeriod: tender.contractPeriod || null, coveredBy: tender.coveredBy || null, awardCriteria: lots.map((lot)=>lot.awardCriteria).filter(Boolean), documents, documentCount: documents.length, itemCount: items.length }, raw_payload: raw });
  }
  getOfficialUrl(raw: Raw) { return ocdsNoticeUrl(raw, this.config); }
}

export const contractsFinderAdapter = new OcdsAdapter({ slug: "uk-contracts-finder", name: "UK Contracts Finder", endpoint: "https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search", country: "United Kingdom", countryCode: "GB" });
export const findATenderAdapter = new OcdsAdapter({ slug: "uk-find-a-tender", name: "UK Find a Tender", endpoint: "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages", country: "United Kingdom", countryCode: "GB" });
