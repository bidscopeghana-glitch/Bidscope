import { z } from "zod";
import { enforceSourceRateLimit, fetchWithRetry, parseDate, slugify, stableHash, stripImportedHtml } from "./safety.ts";
import type { AdapterHealth, NormalizedAward, NormalizedOpportunity, NormalizedProject, ProcurementSourceAdapter } from "./types.ts";

const UnknownRecord = z.record(z.string(), z.unknown());
type WorldBankRaw = z.infer<typeof UnknownRecord>;
const NoticeEnvelope = z.object({ total: z.union([z.number(), z.string()]).optional(), procnotices: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]) }).passthrough();
const ProjectEnvelope = z.object({ projects: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]) }).passthrough();
const AwardEnvelope = z.object({ data: z.array(z.unknown()).default([]), count: z.union([z.number(), z.string()]).optional() }).passthrough();

function stringValue(record: WorldBankRaw, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
    if (Array.isArray(value)) { const joined = value.filter((item): item is string => typeof item === "string").join(", "); if (joined) return joined; }
  }
  return null;
}

function records(value: unknown[] | Record<string, unknown>) { return (Array.isArray(value) ? value : Object.values(value)).map((item) => UnknownRecord.parse(item)); }
function isGhana(value: string | null) { return Boolean(value && /(^|[,;|/\s])ghana($|[,;|/\s])/i.test(value)); }
function isAwardNotice(record: WorldBankRaw) { return /contract\s+award/i.test(stringValue(record, "notice_type", "notice_type_name") || ""); }
function projectUrl(id: string) { return `https://projects.worldbank.org/en/projects-operations/project-detail/${encodeURIComponent(id)}`; }

export class WorldBankAdapter implements ProcurementSourceAdapter<WorldBankRaw> {
  readonly slug = "world-bank";
  private readonly noticeEndpoint = process.env.WORLD_BANK_PROCUREMENT_API_URL || "https://search.worldbank.org/api/v2/procnotices";
  private readonly projectsEndpoint = process.env.WORLD_BANK_PROJECTS_API_URL || "https://search.worldbank.org/api/v2/projects";
  private readonly awardsEndpoint = process.env.WORLD_BANK_AWARDS_API_URL || "https://datacatalogapi.worldbank.org/dexapps/fone/api/apiservice?datasetId=DS00005&resourceId=RS00005&type=json";

  private async fetchNoticePage(offset: number, pageSize: number) {
    enforceSourceRateLimit(this.slug, 110);
    const url = new URL(this.noticeEndpoint);
    url.searchParams.set("format", "json"); url.searchParams.set("apilang", "en"); url.searchParams.set("rows", String(pageSize)); url.searchParams.set("os", String(offset)); url.searchParams.set("project_ctry_name", "Ghana");
    const response = await fetchWithRetry(url.toString(), { headers: { Accept: "application/json", "User-Agent": "BidScopeGhana/1.0" } });
    const envelope = NoticeEnvelope.parse(await response.json());
    return { data: records(envelope.procnotices), total: Number(envelope.total || 0) };
  }

  async fetchOpportunities() {
    const pageSize = Math.max(1, Math.min(Number(process.env.WORLD_BANK_PAGE_SIZE || 25), 100));
    const maxPages = Math.max(1, Math.min(Number(process.env.WORLD_BANK_MAX_PAGES || 1), 100));
    const found = new Map<string, WorldBankRaw>();
    const firstPage = await this.fetchNoticePage(0, pageSize);
    for (let page = 0; page < maxPages; page += 1) {
      // The procurement feed is newest-first. Start at offset zero and move
      // forward; reading backwards from `total` imports the oldest notices.
      const offset = page * pageSize;
      const { data, total } = offset === 0 ? firstPage : await this.fetchNoticePage(offset, pageSize);
      for (const record of data) {
        const country = stringValue(record, "project_ctry_name", "country_name", "country");
        const beneficiary = stringValue(record, "beneficiary_countries", "eligibility");
        if ((isGhana(country) || isGhana(beneficiary)) && !isAwardNotice(record)) { const id = stringValue(record, "id", "notice_id"); if (id) found.set(id, record); }
      }
      if (!data.length || data.length < pageSize || (total > 0 && offset + data.length >= total)) break;
    }
    return [...found.values()];
  }

  async fetchOpportunityById(id: string) {
    enforceSourceRateLimit(this.slug, 110);
    const url = new URL(this.noticeEndpoint);
    url.searchParams.set("format", "json"); url.searchParams.set("apilang", "en"); url.searchParams.set("fl", "*"); url.searchParams.set("id", id);
    const response = await fetchWithRetry(url.toString(), { headers: { Accept: "application/json", "User-Agent": "BidScopeGhana/1.0" } });
    const envelope = NoticeEnvelope.parse(await response.json());
    return records(envelope.procnotices)[0] || null;
  }

  async normaliseOpportunity(raw: WorldBankRaw): Promise<NormalizedOpportunity> {
    const id = stringValue(raw, "id", "notice_id"); if (!id) throw new Error("World Bank notice has no stable identifier.");
    const title = stripImportedHtml(stringValue(raw, "bid_description", "notice_title", "project_name") || "World Bank procurement opportunity", 500);
    const description = stripImportedHtml(stringValue(raw, "notice_text", "bid_description") || "");
    const deadline = parseDate(stringValue(raw, "submission_deadline_date", "deadline_date", "submission_date"));
    const noticeType = stringValue(raw, "notice_type", "notice_type_name");
    const group = stringValue(raw, "procurement_group", "procurement_category", "procurement_group_code");
    const category = group === "CW" || /works/i.test(group || "") ? "works" : group === "GO" || /goods/i.test(group || "") ? "goods" : group === "CS" || /consult/i.test(group || "") ? "consulting" : /service/i.test(group || "") ? "services" : "other";
    const now = new Date().toISOString(); const reference = stringValue(raw, "bid_reference_no", "notice_no", "notice_number") || id;
    const projectId = stringValue(raw, "project_id", "projectid"); const officialUrl = this.getOfficialUrl(raw);
    return {
      bidscope_reference: `BS-WB-${id}`.slice(0, 160), slug: `${slugify(title)}-${slugify(id)}`, title,
      summary: stripImportedHtml(stringValue(raw, "project_name") || description, 1000), description,
      buyer_name: stripImportedHtml(stringValue(raw, "contact_organization", "borrower", "implementing_agency") || "World Bank-financed executing agency", 300), buyer_type: "Development partner project",
      country: stringValue(raw, "project_ctry_name", "country_name") || "Ghana", country_code: "GH", region: stringValue(raw, "region_name", "region"), sector: stringValue(raw, "sector", "sector_name"),
      category, subcategory: group, procurement_method: stringValue(raw, "procurement_method_name", "procurement_method"), contract_type: noticeType,
      currency: null, estimated_value: null, minimum_value: null, maximum_value: null,
      published_at: parseDate(stringValue(raw, "noticedate", "publication_date", "notice_date")), deadline_at: deadline, status: deadline && new Date(deadline) < new Date() ? "CLOSED" : "OPEN",
      source_name: "World Bank", source_type: "OPEN_API", external_opportunity_id: id, external_reference: reference, source_resource_id: projectId,
      official_source_url: officialUrl, official_tender_url: officialUrl, official_submission_url: null, submission_platform: "World Bank procurement", submission_method: "View official procurement",
      requires_registration: false, registration_url: null, funding_source: "World Bank", funding_agency: "World Bank Group",
      eligibility_text: stripImportedHtml(stringValue(raw, "eligibility", "eligibility_text") || "", 1000) || null, eligibility_country: "Ghana", documents_url: officialUrl,
      contact_name: stripImportedHtml(stringValue(raw, "contact_name") || "", 300) || null, contact_email: stripImportedHtml(stringValue(raw, "contact_email") || "", 320) || null, contact_phone: stripImportedHtml(stringValue(raw, "contact_phone", "contact_tel") || "", 100) || null,
      last_source_update: now, last_verified_at: now, data_confidence: "VERIFIED_OFFICIAL_SOURCE", verification_status: "VERIFIED",
      raw_source_hash: stableHash(raw), document_fingerprint: stableHash([reference, title, deadline]), raw_payload: raw,
    };
  }

  async fetchProjects(notices: WorldBankRaw[]): Promise<NormalizedProject[]> {
    const projectLimit = Math.max(1, Math.min(Number(process.env.WORLD_BANK_PROJECT_LIMIT || 8), 50));
    const ids = [...new Set(notices.map((record) => stringValue(record, "project_id", "projectid")).filter((id): id is string => Boolean(id)))].slice(0, projectLimit);
    const output: NormalizedProject[] = [];
    for (let index = 0; index < ids.length; index += 4) {
      const results = await Promise.allSettled(ids.slice(index, index + 4).map(async (id) => {
        enforceSourceRateLimit(`${this.slug}-projects`, 60);
        const url = new URL(this.projectsEndpoint); url.searchParams.set("format", "json"); url.searchParams.set("fl", "*"); url.searchParams.set("id", id); url.searchParams.set("apilang", "en");
        const response = await fetchWithRetry(url.toString(), { headers: { Accept: "application/json", "User-Agent": "BidScopeGhana/1.0" } });
        const envelope = ProjectEnvelope.parse(await response.json()); const raw = records(envelope.projects)[0]; if (!raw) throw new Error(`Project ${id} was not returned.`);
        return { external_project_id: id, name: stringValue(raw, "project_name", "projectname") || id, country: stringValue(raw, "countryname"), country_code: stringValue(raw, "countrycode"), region: stringValue(raw, "regionname"), sector: stringValue(raw, "sector_name", "sector"), status: stringValue(raw, "status"), financing_institution: "World Bank Group", official_url: projectUrl(id), raw_payload: raw, last_verified_at: new Date().toISOString() } satisfies NormalizedProject;
      }));
      for (const result of results) if (result.status === "fulfilled") output.push(result.value);
    }
    return output;
  }

  async fetchAwards(): Promise<NormalizedAward[]> {
    const top = Math.max(1, Math.min(Number(process.env.WORLD_BANK_AWARDS_PAGE_SIZE || 25), 250)); const maxPages = Math.max(1, Math.min(Number(process.env.WORLD_BANK_AWARDS_MAX_PAGES || 1), 50)); const output: NormalizedAward[] = [];
    const firstUrl = new URL(this.awardsEndpoint); firstUrl.searchParams.set("top", String(top)); firstUrl.searchParams.set("skip", "0"); firstUrl.searchParams.set("filter", "borrower_country='Ghana'");
    const firstResponse = await fetchWithRetry(firstUrl.toString(), { headers: { Accept: "application/json", "User-Agent": "BidScopeGhana/1.0" } });
    const firstEnvelope = AwardEnvelope.parse(await firstResponse.json());
    const total = Number(firstEnvelope.count || firstEnvelope.data.length); const start = Math.max(0, total - (top * maxPages));
    for (let page = 0; page < maxPages; page += 1) {
      enforceSourceRateLimit(`${this.slug}-awards`, 60);
      const skip = start + (page * top);
      const envelope = skip === 0 ? firstEnvelope : await (async()=>{const url = new URL(this.awardsEndpoint); url.searchParams.set("top", String(top)); url.searchParams.set("skip", String(skip)); url.searchParams.set("filter", "borrower_country='Ghana'"); const response = await fetchWithRetry(url.toString(), { headers: { Accept: "application/json", "User-Agent": "BidScopeGhana/1.0" } }); return AwardEnvelope.parse(await response.json());})();
      const data = envelope.data.map((item) => UnknownRecord.parse(item));
      for (const raw of data) {
        if (!isGhana(stringValue(raw, "borrower_country"))) continue;
        const awardId = stringValue(raw, "wb_contract_number", "borrower_contract_reference_number"); if (!awardId) continue;
        const projectId = stringValue(raw, "project_id");
        output.push({ external_award_id: awardId, project_external_id: projectId, opportunity_external_id: null, buyer_name: null, title: stringValue(raw, "contract_description") || "World Bank-financed contract award", reference_number: stringValue(raw, "borrower_contract_reference_number", "wb_contract_number"), award_date: parseDate(stringValue(raw, "contract_signing_date")), currency: "USD", value: Number(stringValue(raw, "supplier_contract_amount_usd")) || null, procurement_method: stringValue(raw, "procurement_method"), source_url: projectId ? projectUrl(projectId) : "https://financesone.worldbank.org/d/DS00005", supplier_name: stringValue(raw, "supplier"), supplier_country: stringValue(raw, "supplier_country", "supplier_country_code"), raw_payload: raw });
      }
      if (data.length < top || skip + data.length >= total) break;
    }
    return output;
  }

  getOfficialUrl(raw: WorldBankRaw) { const id = stringValue(raw, "id", "notice_id") || ""; return `https://projects.worldbank.org/en/projects-operations/procurement-detail/${encodeURIComponent(id)}`; }
  getSubmissionUrl() { return null; }
  async healthCheck(): Promise<AdapterHealth> {
    try { const result = await this.fetchNoticePage(0, 1); return { ok: true, message: `Official open API connected; ${result.total || result.data.length} records reported by the filtered query. Authentication not required.`, checkedAt: new Date().toISOString() }; }
    catch (error) { return { ok: false, message: error instanceof Error ? error.message : "World Bank API check failed.", checkedAt: new Date().toISOString() }; }
  }
}
