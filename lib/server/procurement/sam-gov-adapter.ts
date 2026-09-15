import { normalize, text } from "./normalization.ts";
import { enforceSourceRateLimit, fetchWithRetry, parseDate } from "./safety.ts";
import type { AdapterHealth, NormalizedOpportunity, ProcurementSourceAdapter } from "./types.ts";

type Raw = Record<string, unknown>;
function value(row: Raw, ...keys: string[]) { for (const key of keys) { const candidate = row[key]; if (typeof candidate === "string" && candidate.trim()) return candidate.trim(); } return null; }
export class SamGovAdapter implements ProcurementSourceAdapter<Raw> {
  readonly slug = "sam-gov";
  private key() { const key = process.env.SAM_GOV_API_KEY?.trim(); if (!key) throw new Error("SAM_GOV_API_KEY is required by the official SAM.gov Opportunities API."); return key; }
  private async request(limit: number) {
    const endpoints = [
      "https://api.sam.gov/opportunities/v2/search",
      "https://api.sam.gov/prod/opportunities/v2/search",
    ];
    const now = new Date();
    const from = new Date(now.getTime() - 31 * 86400000);
    const format = (date: Date) => `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
    let lastError: unknown;

    for (const endpoint of endpoints) {
      const url = new URL(endpoint);
      url.searchParams.set("api_key", this.key());
      url.searchParams.set("postedFrom", format(from));
      url.searchParams.set("postedTo", format(now));
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("offset", "0");

      try {
        const response = await fetchWithRetry(url.toString(), {
          headers: { Accept: "application/json", "User-Agent": "BidScopeGhana/1.0" },
        });
        return await response.json() as { opportunitiesData?: unknown[]; totalRecords?: number };
      } catch (error) {
        lastError = error;
        if (!(error instanceof Error) || !error.message.includes("HTTP 404")) throw error;
      }
    }

    throw new Error(
      lastError instanceof Error && lastError.message.includes("HTTP 404")
        ? "SAM.gov Opportunities API could not be reached using either official endpoint. Confirm that SAM_GOV_API_KEY is a personal public API key from SAM.gov Account Details."
        : "SAM.gov Opportunities API request failed.",
    );
  }
  async fetchOpportunities() {
    enforceSourceRateLimit(this.slug, 10);
    const payload = await this.request(100);
    return (payload.opportunitiesData || []).filter((item): item is Raw => !!item && typeof item === "object");
  }
  async fetchOpportunityById(id: string) { return (await this.fetchOpportunities()).find((r) => value(r, "noticeId", "solicitationNumber") === id) || null; }
  async normaliseOpportunity(raw: Raw): Promise<NormalizedOpportunity> { const id = value(raw, "noticeId", "solicitationNumber") || crypto.randomUUID(); const title = text(value(raw, "title") || "SAM.gov opportunity"); const office = [value(raw, "department"), value(raw, "subTier"), value(raw, "office")].filter(Boolean).join(" · "); const poc = Array.isArray(raw.pointOfContact) ? raw.pointOfContact[0] as Raw : {}; const link = value(raw, "uiLink") || `https://sam.gov/opp/${encodeURIComponent(id)}/view`; return normalize({ title, summary: text(value(raw, "description") || title, 1200), description: text(value(raw, "description") || title, 25000), buyer_name: office || "United States Government", buyer_type: "Federal government", country: "United States", country_code: "US", region: "International", sector: value(raw, "naicsCode", "classificationCode"), category: /construction|works/i.test(title) ? "works" : /supply|equipment|product/i.test(title) ? "goods" : "services", contract_type: value(raw, "type", "typeOfSetAsideDescription"), published_at: parseDate(value(raw, "postedDate")), deadline_at: parseDate(value(raw, "responseDeadLine", "archiveDate")), source_name: "SAM.gov", source_type: "API", external_opportunity_id: id, external_reference: value(raw, "solicitationNumber") || id, official_source_url: link, official_tender_url: link, documents_url: value(raw, "additionalInfoLink") || link, funding_source: "United States Government", eligibility_status: "UNCLEAR", eligibility_text: "SAM.gov publishes U.S. federal opportunities. A Ghanaian business must verify entity registration, exclusions, place of performance, set-aside status and solicitation-specific eligibility before bidding.", procurement_codes: [value(raw, "naicsCode"), value(raw, "classificationCode")].filter((x): x is string => !!x), contact_name: value(poc, "fullName"), contact_email: value(poc, "email"), contact_phone: value(poc, "phone"), source_details: { placeOfPerformance: raw.placeOfPerformance, setAside: value(raw, "typeOfSetAsideDescription"), award: raw.award }, raw_payload: raw }); }
  getOfficialUrl(raw: Raw) { return value(raw, "uiLink") || "https://sam.gov/content/opportunities"; }
  getSubmissionUrl() { return null; }
  async healthCheck(): Promise<AdapterHealth> { try { this.key(); const payload = await this.request(1); return { ok: true, message: `Official SAM.gov Opportunities API is responding${typeof payload.totalRecords === "number" ? ` (${payload.totalRecords} recent records available)` : ""}.`, checkedAt: new Date().toISOString() }; } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "SAM.gov configuration failed.", checkedAt: new Date().toISOString() }; } }
}
