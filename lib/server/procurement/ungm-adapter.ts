import { normalize, text } from "./normalization.ts";
import { enforceSourceRateLimit, fetchWithRetry, parseDate } from "./safety.ts";
import type { AdapterHealth, NormalizedOpportunity, ProcurementSourceAdapter } from "./types.ts";

type Raw = Record<string, unknown>;
const base = "https://www.ungm.org";
function decode(value: string) { return text(value).replace(/&amp;/g, "&").replace(/&#39;/g, "'"); }
function pick(value: string, pattern: RegExp) { return decode(value.match(pattern)?.[1] || ""); }
function dateFrom(value: string) { return parseDate(value.replace(/(\d{2})-(\w{3})-(\d{4})/, "$1 $2 $3")); }
async function mapLimited<T, R>(values: T[], mapper: (value: T) => Promise<R>) { const output: R[] = []; for (let i = 0; i < values.length; i += 4) output.push(...await Promise.all(values.slice(i, i + 4).map(mapper))); return output; }

export class UngmAdapter implements ProcurementSourceAdapter<Raw> {
  readonly slug = "ungm";
  async fetchOpportunities() {
    const found = new Map<string, Raw>();
    const pages = Math.max(1, Math.min(Number(process.env.UNGM_MAX_PAGES || 3), 10));
    for (let page = 0; page < pages; page += 1) {
      enforceSourceRateLimit(this.slug, 6);
      const response = await fetchWithRetry(`${base}/Public/Notice/Search`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "BidScopeGhana/1.0" }, body: JSON.stringify({ PageIndex: page, PageSize: 15, Title: "", Description: "", Reference: "", PublishedFrom: "", PublishedTo: "", DeadlineFrom: new Date().toISOString().slice(0, 10), DeadlineTo: "", Countries: [2370], Agencies: [], UNSPSCs: [], NoticeTypes: [], SortField: "DatePublished", SortAscending: false, isPicker: false, IsSustainable: false, IsActive: true, NoticeDisplayType: null, NoticeSearchTotalLabelId: "noticeSearchTotal", TypeOfCompetitions: [] }) });
      const body = await response.text();
      let html = body;
      if (body.trimStart().startsWith("{")) { const payload = JSON.parse(body) as { Html?: string; html?: string }; html = payload.Html || payload.html || ""; }
      for (const row of html.match(/<div[^>]+data-noticeid=["'][^"']+["'][\s\S]*?(?=<div[^>]+data-noticeid=|$)/gi) || []) {
        const id = row.match(/data-noticeid=["']([^"']+)/i)?.[1]; if (!id) continue;
        const url = `${base}/Public/Notice/${id}`;
        const dates = [...row.matchAll(/\b\d{1,2}-[A-Z][a-z]{2}-20\d{2}(?:\s+\d{2}:\d{2})?/g)].map((match) => match[0]);
        found.set(id, { id, url, title: pick(row, /class=["'][^"']*ungm-title[^"']*["'][^>]*>([\s\S]*?)<\/span>/i), agency: pick(row, /class=["'][^"']*resultAgency[^"']*["'][^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i), reference: pick(row, /data-description=["']Reference["'][^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i), published: dates[1] || "", deadline: dates[0] || "", row });
      }
    }
    return mapLimited([...found.values()], async (row) => { try { const html = await (await fetchWithRetry(String(row.url), { headers: { Accept: "text/html", "User-Agent": "BidScopeGhana/1.0" } })).text(); return { ...row, detailHtml: html, detailText: decode(html), documents: [...html.matchAll(/href=["']([^"']*(?:Download|Document)[^"']*)["']/gi)].map((m) => new URL(m[1], base).toString()) }; } catch { return row; } });
  }
  async fetchOpportunityById(id: string) { return (await this.fetchOpportunities()).find((row) => String(row.id) === id) || null; }
  async normaliseOpportunity(raw: Raw): Promise<NormalizedOpportunity> {
    const body = String(raw.detailText || ""); const title = String(raw.title || pick(String(raw.detailHtml || ""), /<h1[^>]*>([\s\S]*?)<\/h1>/i));
    const codes = [...new Set([...body.matchAll(/\b\d{8}\b/g)].map((m) => m[0]))].slice(0, 30);
    const registration = body.match(/Registration level\s*:?\s*([^\n]{2,150})/i)?.[1]?.trim() || null;
    const description = body.match(/Description\s*([\s\S]{30,12000}?)(?=Documents|UNSPSC|Contact|View document)/i)?.[1]?.trim() || body;
    const deadline = dateFrom(String(raw.deadline || body.match(/Deadline\s*:?\s*([^\n]+)/i)?.[1] || ""));
    return normalize({ title, summary: description.slice(0, 1200), description, buyer_name: String(raw.agency || body.match(/UN organization\s*:?\s*([^\n]+)/i)?.[1] || "United Nations"), buyer_type: "United Nations agency", country: "Ghana", country_code: "GH", region: "Africa", category: /consult/i.test(title) ? "consulting" : /construction|works/i.test(title) ? "works" : /supply|goods|equipment/i.test(title) ? "goods" : "services", contract_type: body.match(/Type of notice\s*:?\s*([^\n]+)/i)?.[1]?.trim() || null, published_at: dateFrom(String(raw.published || body.match(/Published\s*:?\s*([^\n]+)/i)?.[1] || "")), deadline_at: deadline, source_name: "UNGM", source_type: "STRUCTURED_WEB", external_opportunity_id: String(raw.id), external_reference: String(raw.reference || body.match(/Reference\s*:?\s*([^\n]+)/i)?.[1] || raw.id), official_source_url: String(raw.url), official_tender_url: String(raw.url), documents_url: (raw.documents as string[] | undefined)?.[0] || String(raw.url), funding_source: String(raw.agency || "United Nations"), eligibility_country: "GH", eligibility_status: "INTERNATIONAL_ELIGIBLE", eligibility_text: `Ghana is listed as a beneficiary country. ${registration ? `UNGM registration level: ${registration}.` : "Confirm supplier eligibility and registration in the official notice."}`, requires_registration: true, registration_url: "https://www.ungm.org/Account/Registration", procurement_codes: codes, qualification_requirements: body.match(/(?:Qualification|Requirements|Eligibility)([\s\S]{10,3000}?)(?=Documents|Contact|Deadline|$)/i)?.[1]?.trim() || null, contact_email: body.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] || null, source_details: { registrationLevel: registration, documents: raw.documents || [], beneficiaryCountry: "Ghana" }, raw_payload: raw });
  }
  getOfficialUrl(raw: Raw) { return String(raw.url || `${base}/Public/Notice`); }
  getSubmissionUrl() { return null; }
  async healthCheck(): Promise<AdapterHealth> { try { const rows = await this.fetchOpportunities(); return { ok: true, message: `Official public UNGM search connected; ${rows.length} active Ghana-beneficiary notices returned.`, checkedAt: new Date().toISOString() }; } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "UNGM check failed.", checkedAt: new Date().toISOString() }; } }
}
