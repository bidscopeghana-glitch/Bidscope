import { z } from "zod";
import { firstDate, normalize, text } from "./normalization.ts";
import { enforceSourceRateLimit, fetchWithRetry } from "./safety.ts";
import type { AdapterHealth, NormalizedOpportunity, ProcurementSourceAdapter } from "./types.ts";

type Raw = Record<string, unknown>;
const RecordSchema = z.record(z.string(), z.unknown());
const ArrayRecordSchema = z.array(RecordSchema);

function nested(record: Raw, path: string) { return path.split(".").reduce<unknown>((value, key) => value && typeof value === "object" ? (value as Raw)[key] : undefined, record); }
function strings(value: unknown): string[] { if (typeof value === "string") return [value]; if (Array.isArray(value)) return value.flatMap(strings); if (value && typeof value === "object") return Object.values(value as Raw).flatMap(strings); return []; }
function pick(record: Raw, ...paths: string[]) { for (const path of paths) { const value = strings(nested(record, path)).find(Boolean); if (value) return value; } return null; }

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
    const payload = RecordSchema.parse(await response.json()); return ArrayRecordSchema.parse(payload.notices || payload.results || []);
  }
  async normaliseOpportunity(raw: Raw) { const id = pick(raw, "publication-number") || "ted"; const title = pick(raw, "notice-title") || "European public procurement opportunity"; const countries = strings(raw["place-of-performance-country-proc"]); const eligibilityText = "Published through TED. Ghanaian supplier eligibility is not assumed; review participation, qualification and place-of-performance requirements in the official notice."; return normalize({ title, buyer_name: pick(raw, "buyer-name") || "European public authority", country: countries.join(", ") || "European Union", country_code: countries[0]?.length === 2 ? countries[0] : "EU", sector: strings(raw["classification-cpv"]).join(", ") || null, procurement_method: pick(raw, "procedure-type"), contract_type: pick(raw, "form-type"), published_at: firstDate(pick(raw, "publication-date")), deadline_at: firstDate(pick(raw, "deadline-receipt-tender-date-lot"), pick(raw, "deadline-receipt-request")), source_name: "Tenders Electronic Daily", source_type: "OPEN_API", external_opportunity_id: id, external_reference: id, official_source_url: this.getOfficialUrl(raw), funding_source: "European public procurement", eligibility_text: eligibilityText, eligibility_status: "UNCLEAR", eligibility_summary: "International eligibility is unconfirmed; check the official TED notice.", raw_payload: raw }); }
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
  async normaliseOpportunity(raw: Raw) { const tender = (raw.tender && typeof raw.tender === "object" ? raw.tender : {}) as Raw; const id = String(raw.ocid || raw.id || tender.id || "ocds"); const title = text(tender.title || raw.title || "UK public procurement opportunity", 500); const buyer = (raw.buyer && typeof raw.buyer === "object" ? raw.buyer : {}) as Raw; const eligibilityText = `${text(tender.eligibilityCriteria || "")} ${text(tender.description || "")}`.trim(); const official = pick(raw, "links.tender", "links.self", "url") || this.config.endpoint; return normalize({ title, summary: text(tender.description), description: text(tender.description), buyer_name: text(buyer.name || "UK public authority", 400), country: this.config.country, country_code: this.config.countryCode, category: /works/i.test(String(tender.mainProcurementCategory)) ? "works" : /goods/i.test(String(tender.mainProcurementCategory)) ? "goods" : /services/i.test(String(tender.mainProcurementCategory)) ? "services" : "other", procurement_method: text(tender.procurementMethodDetails || tender.procurementMethod) || null, published_at: firstDate(raw.date), deadline_at: firstDate(nested(tender, "tenderPeriod.endDate")), source_name: this.config.name, source_type: "OPEN_API", external_opportunity_id: id, external_reference: String(tender.id || id), official_source_url: official, funding_source: "United Kingdom public procurement", eligibility_text: eligibilityText || "Eligibility must be verified in the official notice.", eligibility_status: "UNCLEAR", eligibility_summary: "No assumption of Ghanaian eligibility; inspect the official participation rules.", raw_payload: raw }); }
  getOfficialUrl(raw: Raw) { return pick(raw, "links.tender", "links.self", "url") || this.config.endpoint; }
}

export const contractsFinderAdapter = new OcdsAdapter({ slug: "uk-contracts-finder", name: "UK Contracts Finder", endpoint: "https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search", country: "United Kingdom", countryCode: "GB" });
export const findATenderAdapter = new OcdsAdapter({ slug: "uk-find-a-tender", name: "UK Find a Tender", endpoint: "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages", country: "United Kingdom", countryCode: "GB" });
