import { z } from "zod";
import { firstDate, normalize, text } from "./normalization.ts";
import { enforceSourceRateLimit, fetchWithRetry } from "./safety.ts";
import type { AdapterHealth, NormalizedOpportunity, ProcurementSourceAdapter } from "./types.ts";
import { extractOfficialPdfText, parseGhanepsDetail } from "./ghana-adapters.ts";

type Raw = Record<string, unknown>;
const RecordSchema = z.record(z.string(), z.unknown());

function decode(value: string) { return text(value.replace(/&ndash;|&#8211;/g, "-").replace(/&mdash;|&#8212;/g, "—")); }
function match(value: string, pattern: RegExp) { return decode(value.match(pattern)?.[1] || ""); }
function absolute(base: string, value: string) { try { return new URL(value, base).toString(); } catch { return base; } }
function section(value: string, number: number) { return value.match(new RegExp(`(?:^|\\s)${number}\\.\\s*([\\s\\S]*?)(?=\\s${number + 1}\\.\\s|$)`, "i"))?.[1]?.replace(/\s+/g, " ").trim() || null; }
function ghanepsNoticeFacts(value: string) {
  const scope = section(value, 2); const documentContents = section(value, 4); const eligibility = section(value, 5); const submission = section(value, 10); const security = section(value, 11);
  const duration = value.match(/(?:completed|completion)\s+in\s+([^.;]+?(?:months?|weeks?|days?))/i)?.[1]?.trim() || null;
  const email = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null;
  const phone = value.match(/\+?233\s*[- ]?\d[\d -]{7,}/)?.[0]?.replace(/\s+/g, " ").trim() || null;
  return { scope, documentContents, eligibility, submission, security, duration, email, phone };
}
function sourceHealth(slug: string, fetcher: () => Promise<unknown[]>) {
  return async (): Promise<AdapterHealth> => { try { const rows = await fetcher(); return { ok: true, message: `Official source connected; ${rows.length} records returned in the verification page.`, checkedAt: new Date().toISOString() }; } catch (error) { return { ok: false, message: error instanceof Error ? error.message : `${slug} check failed`, checkedAt: new Date().toISOString() }; } };
}

abstract class BaseAdapter implements ProcurementSourceAdapter<Raw> {
  abstract readonly slug: string;
  abstract fetchOpportunities(): Promise<Raw[]>;
  abstract normaliseOpportunity(raw: Raw): Promise<NormalizedOpportunity>;
  abstract getOfficialUrl(raw: Raw): string;
  getSubmissionUrl() { return null; }
  async fetchOpportunityById(id: string) { return (await this.fetchOpportunities()).find((row) => String(row.id) === id) || null; }
  async healthCheck() { return sourceHealth(this.slug, () => this.fetchOpportunities())(); }
}

export class GhanepsAdapter extends BaseAdapter {
  readonly slug = "ghaneps";
  private endpoint = "https://www.ghaneps.gov.gh/epps/viewCFTSAction.do?T01_ps=50";
  async fetchOpportunities() {
    enforceSourceRateLimit(this.slug, 8);
    const response = await fetchWithRetry(this.endpoint, { headers: { "User-Agent": "BidScopeGhana/1.0 (+https://www.bidscopeghana.com)", Accept: "text/html" } });
    const html = await response.text(); const rows = html.match(/<tr\b[\s\S]*?<\/tr>/gi) || []; const out: Raw[] = [];
    for (const row of rows) {
      const detail = row.match(/href=["']([^"']*prepareViewCfTWS[^"']*resourceId=([^&"']+)[^"']*)/i);
      if (!detail) continue;
      const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1]);
      const title = decode(cells[1] || ""); const buyer = decode(cells[2] || ""); const description = match(cells[3] || "", /title=["']([^"']+)/i) || decode(cells[3] || "");
      if (!title) continue;
      const notice = row.match(/href=["']([^"']*downloadNoticeForAdvSearch[^"']*resourceId=[^&"']+[^"']*)/i);
      out.push({ id: detail[2], title, buyer, description, deadline: decode(cells[4] || ""), method: decode(cells[5] || ""), sourceStatus: decode(cells[6] || ""), published: decode(cells[8] || ""), url: absolute(this.endpoint, detail[1]), noticeUrl: notice ? absolute(this.endpoint, notice[1]) : null, rawHtml: row });
    }
    const enriched: Raw[] = [];
    for (let index = 0; index < out.length; index += 5) {
      const batch = await Promise.all(out.slice(index, index + 5).map(async (item) => {
        try {
          const detailHtml = await (await fetchWithRetry(String(item.url), { headers: { Accept: "text/html", "User-Agent": "BidScopeGhana/1.0" } })).text();
          const noticeText = item.noticeUrl ? await extractOfficialPdfText(String(item.noticeUrl)).catch(() => "") : "";
          return { ...item, detailHtml, noticeText };
        }
        catch { return item; }
      }));
      enriched.push(...batch);
    }
    return enriched;
  }
  async normaliseOpportunity(raw: Raw) {
    const detail = parseGhanepsDetail(String(raw.detailHtml || "")); const fields = detail.fields; const field = (...names: string[]) => names.map((name) => fields[name]).find(Boolean) || null;
    const noticeText = text(raw.noticeText, 50_000); const notice = ghanepsNoticeFacts(noticeText); const shortDescription = field("Description") || String(raw.description || "");
    const fee = field("Payment Amount (GHS)"); const securityAmount = field("Bid Security Amount (GHS)"); const securityType = field("Bid Security Amount Type");
    const bidSecurity = [field("Bid Security Type"), securityAmount ? `${securityAmount}${/percent/i.test(securityType || "") ? "%" : " GHS"}` : null].filter(Boolean).join(" · ") || notice.security;
    const qualification = [field("Grade Type") ? `Contractor grade: ${field("Grade Type")}.` : null, field("Postqualification") === "Yes" ? "Postqualification applies." : null, notice.eligibility].filter(Boolean).join(" ") || null;
    const submission = notice.submission || "Submit through the official GHANEPS opportunity page and follow all published electronic submission instructions.";
    const sourceDetails = { ...fields, ...(notice.scope ? { "Detailed scope": notice.scope } : {}), ...(notice.documentContents ? { "Tender document contents": notice.documentContents } : {}), ...(notice.duration ? { "Contract duration": notice.duration } : {}), ...(notice.eligibility ? { "Eligibility and qualification": notice.eligibility } : {}), "Official notice PDF": raw.noticeUrl || null };
    return normalize({ title: field("Tender Title") || String(raw.title), summary: notice.scope || shortDescription, description: noticeText || shortDescription, buyer_name: field("Name of Procuring Entity") || String(raw.buyer || "Ghana public entity"), country: "Ghana", country_code: "GH", category: /works/i.test(field("Procurement Type") || "") ? "works" : /goods/i.test(field("Procurement Type") || "") ? "goods" : /consult/i.test(field("Procurement Type") || "") ? "consulting" : "services", procurement_method: field("Procurement Method") || String(raw.method || "") || null, contract_type: field("Procurement Type"), published_at: firstDate(field("Date of Publication/Invitation"), raw.published), deadline_at: firstDate(field("Bid submission deadline date"), raw.deadline), opening_at: firstDate(field("Bid Opening Date")), clarification_deadline_at: firstDate(field("End of Clarification Period")), source_name: "GHANEPS", source_type: "STRUCTURED_WEB", external_opportunity_id: String(raw.id), external_reference: field("Tender Unique ID", "APP Reference Number") || String(raw.id), official_source_url: String(raw.url), official_tender_url: String(raw.url), official_submission_url: String(raw.url), submission_platform: "GHANEPS", submission_method: "Electronic submission through the GHANEPS e-GP portal", requires_registration: true, registration_url: "https://www.ghaneps.gov.gh/epps/register.do", funding_source: /DACF/i.test(noticeText) ? "District Assemblies Common Fund (DACF)" : "Government of Ghana", eligibility_country: "GH", eligibility_text: notice.eligibility, documents_url: String(raw.noticeUrl || "") || null, procurement_codes: (field("UNSPSC Codes") || "").match(/\b\d{6,8}\b/g) || [], participation_fee_amount: fee ? Number(fee.replace(/[^\d.]/g, "")) || null : null, participation_fee_currency: fee ? "GHS" : null, bid_security_requirement: bidSecurity, bid_security_text: bidSecurity, qualification_requirements: qualification, submission_instructions: submission, contact_email: notice.email, contact_phone: notice.phone, source_details: sourceDetails, raw_payload: raw });
  }
  getOfficialUrl(raw: Raw) { return String(raw.url || this.endpoint); }
}

export class GhanaRoadsAdapter extends BaseAdapter {
  readonly slug = "mrh-procurement";
  private endpoint = "https://mrh.gov.gh/wp-json/wp/v2/posts?categories=29&per_page=100&_embed=1";
  async fetchOpportunities() { enforceSourceRateLimit(this.slug, 20); const response = await fetchWithRetry(this.endpoint, { headers: { Accept: "application/json", "User-Agent": "BidScopeGhana/1.0" } }); return z.array(RecordSchema).parse(await response.json()); }
  async normaliseOpportunity(raw: Raw) { const content = String((raw.content as Raw)?.rendered || ""); const title = text((raw.title as Raw)?.rendered || ""); const body = text(content); const deadline = firstDate(body.match(/(?:deadline|closing date|submission[^.]{0,30})(?:\s*(?:is|:|-))?\s*([A-Z][a-z]+\s+\d{1,2},?\s+\d{4}(?:[^.;]{0,20})?)/i)?.[1]); const pdf = content.match(/href=["']([^"']+\.pdf(?:\?[^"']*)?)/i)?.[1]; return normalize({ title, summary: body, description: body, buyer_name: "Ministry of Roads and Highways, Ghana", country: "Ghana", country_code: "GH", published_at: firstDate(raw.date_gmt, raw.date), deadline_at: deadline, source_name: "Ministry of Roads and Highways", source_type: "OPEN_API", external_opportunity_id: String(raw.id), external_reference: body.match(/(?:reference|ref\.?|contract no\.?)[\s:#-]*([A-Z0-9/_.-]{5,})/i)?.[1] || null, official_source_url: String(raw.link), documents_url: pdf || String(raw.link), funding_source: "Government of Ghana", raw_payload: raw }); }
  getOfficialUrl(raw: Raw) { return String(raw.link); }
}

export class BankOfGhanaAdapter extends BaseAdapter {
  readonly slug = "bank-of-ghana";
  private endpoint = "https://www.bog.gov.gh/wp-json/wp/v2/notice?per_page=100";
  async fetchOpportunities() { enforceSourceRateLimit(this.slug, 20); const response = await fetchWithRetry(this.endpoint, { headers: { Accept: "application/json", "User-Agent": "BidScopeGhana/1.0" } }); const rows = z.array(RecordSchema).parse(await response.json()); return rows.filter((row) => /tender|procurement|expression of interest|request for proposal|prequalification/i.test(text((row.title as Raw)?.rendered))); }
  async normaliseOpportunity(raw: Raw) { const title = text((raw.title as Raw)?.rendered); return normalize({ title, buyer_name: "Bank of Ghana", country: "Ghana", country_code: "GH", published_at: firstDate(raw.date_gmt, raw.date), deadline_at: null, status: "UNKNOWN", source_name: "Bank of Ghana", source_type: "OPEN_API", external_opportunity_id: String(raw.id), official_source_url: String(raw.link), funding_source: "Bank of Ghana", eligibility_summary: "Check the official notice and attached tender document for eligibility and closing date.", raw_payload: raw }); }
  getOfficialUrl(raw: Raw) { return String(raw.link); }
}

abstract class RegionalHtmlAdapter extends BaseAdapter {
  abstract readonly endpoint: string; abstract readonly sourceName: string; abstract readonly country: string; abstract parse(html: string): Raw[];
  async fetchOpportunities() { enforceSourceRateLimit(this.slug, 10); const response = await fetchWithRetry(this.endpoint, { headers: { Accept: "text/html", "User-Agent": "BidScopeGhana/1.0 (+https://www.bidscopeghana.com)" } }); return this.parse(await response.text()); }
  async normaliseOpportunity(raw: Raw) { const deadline = firstDate(raw.deadline); return normalize({ title: String(raw.title), summary: String(raw.summary || ""), description: String(raw.summary || ""), buyer_name: this.sourceName, country: this.country, country_code: String(raw.countryCode || "ZZ"), published_at: firstDate(raw.published), deadline_at: deadline, source_name: this.sourceName, source_type: "STRUCTURED_WEB", external_opportunity_id: String(raw.id || raw.url), external_reference: String(raw.reference || "") || null, official_source_url: String(raw.url), funding_source: this.sourceName, eligibility_text: String(raw.eligibility || "") || null, raw_payload: raw }); }
  getOfficialUrl(raw: Raw) { return String(raw.url || this.endpoint); }
}

export class EcowasAdapter extends RegionalHtmlAdapter {
  readonly slug = "ecowas"; readonly endpoint = "https://www.ecowas.int/procurement/"; readonly sourceName = "ECOWAS"; readonly country = "ECOWAS region";
  parse(html: string) {
    const current = (html.match(/<li>\s*<a\b[^>]*href=["'][^"']+\/nwp_events\/[^"']+["'][\s\S]*?<\/a>\s*<\/li>/gi) || []).flatMap((item) => {
      const href = item.match(/href=["']([^"']+)["']/i)?.[1];
      const title = match(item, /<h6\b[^>]*>([\s\S]*?)<\/h6>/i);
      const deadline = match(item, /Closing date:\s*([\s\S]*?)<\/small>/i);
      if (!href || !title || !deadline || /job|vacanc|immersion programme|annual procurement plan|general procurement notice/i.test(title)) return [];
      return [{ id: href, url: absolute(this.endpoint, href), title, deadline, summary: "Current ECOWAS procurement notice.", countryCode: "ZZ", eligibility: "Published by ECOWAS, of which Ghana is a member. Confirm tender-specific supplier, registration and location requirements in the official notice." }];
    });
    if (current.length) return current;
    return (html.match(/<article\b[^>]*class=["'][^"']*ev-card[\s\S]*?<\/article>/gi) || []).flatMap((card) => { const link = card.match(/<a\b[^>]*class=["'][^"']*ev-link[^"']*["'][^>]*href=["']([^"']+)["'][^>]*aria-label=["']([^"']+)/i) || card.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*aria-label=["']([^"']+)/i); if (!link) return []; const title = decode(link[2]); if (/job|vacanc|immersion programme/i.test(title)) return []; const range = match(card, /class=["'][^"']*ev-range[^"']*["'][^>]*>([\s\S]*?)<\/span>/i); return [{ id: link[1], url: absolute(this.endpoint, link[1]), title, deadline: range.split(/\s+[–—-]\s+/).at(-1), summary: match(card, /class=["'][^"']*ev-excerpt[^"']*["'][^>]*>([\s\S]*?)<\/p>/i), countryCode: "ZZ", eligibility: "Published by ECOWAS, of which Ghana is a member. Confirm tender-specific supplier, registration and location requirements in the official notice." }]; });
  }
}

export class AfricanUnionAdapter extends RegionalHtmlAdapter {
  readonly slug = "african-union"; readonly endpoint = "https://au.int/en/bids"; readonly sourceName = "African Union"; readonly country = "African Union";
  parse(html: string) { return (html.match(/<tr\b[\s\S]*?<\/tr>/gi) || []).flatMap((row) => { const link = row.match(/<a\b[^>]*href=["']([^"']*\/bids\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/i); const title = match(row, /class=["'][^"']*views-field-title[^"']*["'][^>]*>([\s\S]*?)<\/td>/i) || decode(link?.[2] || ""); if (!link || !title) return []; const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((item) => decode(item[1])); const reference = cells.find((cell) => /[A-Z]{2,}[/-]\w+/i.test(cell)) || ""; const dates = [...row.matchAll(/<time\b[^>]*datetime=["']([^"']+)["']/gi)].map((item) => item[1]); const deadline = dates.at(-1) || cells.flatMap((cell) => cell.match(/\d{1,2}\s+[A-Z][a-z]+\s+20\d{2}|20\d{2}-\d{2}-\d{2}/g) || []).at(-1) || ""; return [{ id: reference || link[1], url: absolute(this.endpoint, link[1]), title, reference, deadline, published: dates[0], summary: cells.join(" "), countryCode: "ZZ", eligibility: "Published by the African Union. Ghana is an AU member state, but tender-specific supplier and country restrictions must be confirmed in the official notice." }]; }); }
}
