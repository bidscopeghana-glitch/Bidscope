import { PDFParse } from "pdf-parse";
import { z } from "zod";
import { firstDate, normalize, text } from "./normalization.ts";
import { enforceSourceRateLimit, fetchWithRetry, parseDate } from "./safety.ts";
import type { AdapterHealth, NormalizedOpportunity, ProcurementSourceAdapter } from "./types.ts";

type Raw = Record<string, unknown>;
const RecordSchema = z.record(z.string(), z.unknown());

function decode(value: string) {
  return text(value)
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&ndash;|&mdash;/gi, "-")
    .replace(/&rsquo;|&lsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"');
}
function absolute(base: string, value: string) { try { return new URL(value, base).toString(); } catch { return base; } }
function match(value: string, pattern: RegExp) { return decode(value.match(pattern)?.[1] || ""); }
function number(value: unknown) { const parsed = Number(String(value || "").replace(/[^\d.]/g, "")); return Number.isFinite(parsed) ? parsed : null; }
function category(value: string): NormalizedOpportunity["category"] { return /work|construction|rehabilitation/i.test(value) ? "works" : /consult/i.test(value) ? "consulting" : /good|supply|vehicle|equipment|furniture/i.test(value) ? "goods" : /service/i.test(value) ? "services" : "other"; }
function futureDate(value: string, publishedAt?: string | null) {
  const monthPattern = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December),?\s+(20\d{2})(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/gi;
  const candidates = [...value.matchAll(monthPattern)].flatMap((item) => {
    let hour = Number(item[4] || 0); if (item[6]?.toLowerCase() === "pm" && hour < 12) hour += 12; if (item[6]?.toLowerCase() === "am" && hour === 12) hour = 0;
    const parsed = parseDate(`${item[1]} ${item[2]} ${item[3]} ${String(hour).padStart(2, "0")}:${item[5] || "00"} GMT`);
    return parsed ? [parsed] : [];
  });
  const floor = publishedAt ? Date.parse(publishedAt) : Date.now() - 31 * 86_400_000;
  return candidates.filter((item) => Date.parse(item) >= floor).sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1) || null;
}
function labelled(textValue: string, label: string, nextLabels: string[]) {
  const start = textValue.search(new RegExp(`${label}\\s*:`, "i")); if (start < 0) return null;
  const after = textValue.slice(start).replace(new RegExp(`^${label}\\s*:\\s*`, "i"), "");
  const end = nextLabels.map((next) => after.search(new RegExp(`\\s${next}\\s*:`, "i"))).filter((index) => index >= 0).sort((a, b) => a - b)[0];
  return after.slice(0, end ?? Math.min(after.length, 2_000)).trim() || null;
}
async function pooledMap<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
  const output = new Array<R>(items.length); let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => { while (cursor < items.length) { const index = cursor++; output[index] = await mapper(items[index]); } }));
  return output;
}
async function pdfText(url: string) {
  const response = await fetchWithRetry(url, { headers: { Accept: "application/pdf", "User-Agent": "BidScopeGhana/1.0" } }, 2);
  const length = Number(response.headers.get("content-length") || 0); if (length > 12_000_000) throw new Error("Official tender PDF exceeds the safe extraction limit.");
  const data = new Uint8Array(await response.arrayBuffer()); if (data.byteLength > 12_000_000) throw new Error("Official tender PDF exceeds the safe extraction limit.");
  const parser = new PDFParse({ data });
  try { return text((await parser.getText()).text, 50_000); } finally { await parser.destroy(); }
}
function htmlDocumentLinks(base: string, html: string) {
  return [...html.matchAll(/href=["']([^"']+)["']/gi)].map((item) => absolute(base, item[1])).filter((url) => /\.pdf(?:$|\?)|download/i.test(url));
}

abstract class GhanaAdapter implements ProcurementSourceAdapter<Raw> {
  abstract readonly slug: string;
  abstract fetchOpportunities(): Promise<Raw[]>;
  abstract normaliseOpportunity(raw: Raw): Promise<NormalizedOpportunity>;
  abstract getOfficialUrl(raw: Raw): string;
  getSubmissionUrl() { return null; }
  async fetchOpportunityById(id: string) { return (await this.fetchOpportunities()).find((row) => String(row.id) === id) || null; }
  async healthCheck(): Promise<AdapterHealth> { try { const rows = await this.fetchOpportunities(); return { ok: true, message: `Official source connected; ${rows.length} current records returned.`, checkedAt: new Date().toISOString() }; } catch (error) { return { ok: false, message: error instanceof Error ? error.message : `${this.slug} check failed`, checkedAt: new Date().toISOString() }; } }
}

export class BankOfGhanaAdapter extends GhanaAdapter {
  readonly slug = "bank-of-ghana";
  private endpoint = "https://www.bog.gov.gh/wp-json/wp/v2/notice?per_page=20";
  async fetchOpportunities() {
    enforceSourceRateLimit(this.slug, 12);
    const response = await fetchWithRetry(this.endpoint, { headers: { Accept: "application/json", "User-Agent": "BidScopeGhana/1.0" } });
    const rows = z.array(RecordSchema).parse(await response.json()).filter((row) => /tender|procurement|expression of interest|request for proposal|prequalification/i.test(text((row.title as Raw)?.rendered)));
    return pooledMap(rows, 2, async (row) => {
      const link = String(row.link); try {
        const html = await (await fetchWithRetry(link, { headers: { Accept: "text/html", "User-Agent": "BidScopeGhana/1.0" } }, 2)).text();
        const documentUrl = htmlDocumentLinks(link, html)[0] || null;
        const documentText = documentUrl ? await pdfText(documentUrl).catch(() => "") : "";
        return { ...row, detailText: documentText || decode(html), documentUrl };
      } catch { return { ...row, detailText: "", documentUrl: null }; }
    });
  }
  async normaliseOpportunity(raw: Raw) {
    const title = text((raw.title as Raw)?.rendered); const body = text(raw.detailText); const published = firstDate(raw.date_gmt, raw.date); const deadline = futureDate(body, published);
    const reference = body.match(/(?:NOTICE|CONTRACT|PACKAGE)\s*(?:NO\.?|NUMBER)?\s*[:.]?\s*([A-Z0-9][A-Z0-9/.-]{5,})/i)?.[1] || title.match(/Notice\s+No\.?\s*([\w/.-]+)/i)?.[1] || String(raw.id);
    const requirements = body.match(/(?:following eligibility documents|Tenderers shall submit[^.]*documents)[.:]?\s*([\s\S]{20,3000}?)(?=Please note|Interested suppliers|\b5\.)/i)?.[1]?.trim() || null;
    const fee = body.match(/non-refundable fee[^\d]{0,80}(?:GHS|GH¢)\s*([\d,.]+)/i); const security = body.match(/(?:Tender Security|bid security)[\s\S]{0,180}?(\d+(?:\.\d+)?\s*%[^.;]*)/i)?.[1] || null;
    const validity = Number(body.match(/valid for a period of\s+(\d+)\s+days/i)?.[1] || 0) || null; const documentUrl = String(raw.documentUrl || "") || null; const official = String(raw.link);
    return normalize({ title, summary: body.slice(0, 1_000), description: body, buyer_name: "Bank of Ghana", buyer_type: "Central bank", country: "Ghana", country_code: "GH", sector: /vehicle|motor/i.test(title) ? "Transport" : /power|battery|network|IT|digital/i.test(title) ? "Technology and infrastructure" : "General procurement", category: category(title), procurement_method: /national competitive/i.test(`${title} ${body}`) ? "National Competitive Tendering" : null, contract_type: /expression of interest/i.test(title) ? "Expression of Interest" : "Invitation for Tenders", published_at: published, deadline_at: deadline, source_name: "Bank of Ghana", source_type: "OPEN_API", external_opportunity_id: String(raw.id), external_reference: reference, official_source_url: official, official_tender_url: official, documents_url: documentUrl, funding_source: "Bank of Ghana", eligibility_text: requirements, eligibility_country: "GH", participation_fee_amount: fee ? number(fee[1]) : null, participation_fee_currency: fee ? "GHS" : null, bid_security_requirement: security, bid_validity_days: validity, qualification_requirements: requirements, submission_instructions: body.match(/Address for Tender Submission:\s*([\s\S]{10,900}?)(?=\(SGD|THE SECRETARY|$)/i)?.[1]?.trim() || null, contact_address: body.match(/Address for Tender Submission:\s*([\s\S]{10,500}?)(?=\(SGD|THE SECRETARY|$)/i)?.[1]?.trim() || null, source_details: { officialDocument: documentUrl, extraction: documentUrl ? "Official tender PDF" : "Official notice page" }, raw_payload: raw });
  }
  getOfficialUrl(raw: Raw) { return String(raw.link || "https://www.bog.gov.gh/notice/invitation-for-tenders/"); }
}

const ghanepsLabels = ["Name of Procuring Entity", "APP Reference Number", "Tender Unique ID", "Tender Title", "Description", "Requisition Number", "Procurement Type", "Grade Type", "Procurement Method", "Includes eCatalogue", "Commencement Type", "Procurement Technique", "Number of Stages", "Evaluation Mechanism", "Margin of Preference", "Framework Agreement Establishment", "Postqualification", "UNSPSC Codes", "Tender Participation Fees", "Payment Amount\\s*\\(GHS\\)", "Payment Terms and Method", "Bid Security Type", "Bid Security Amount Type", "Bid Security Amount\\s*\\(GHS\\)", "Contract Awarded in Lots", "Bid submission deadline date", "End of Clarification Period", "Bid Opening Date", "Date of Publication/Invitation", "Contract Notice Date"];
export function parseGhanepsDetail(html: string) {
  const clean = decode(html); const fields: Record<string, string> = {};
  for (let index = 0; index < ghanepsLabels.length; index += 1) { const label = ghanepsLabels[index]; const value = labelled(clean, label, ghanepsLabels.slice(index + 1)); if (value) fields[label.replace(/\\s\*\\s\*|\\\(|\\\)/g, "")] = value; }
  return { clean, fields };
}

export class MrhEbidsAdapter extends GhanaAdapter {
  readonly slug = "mrh-ebids"; private endpoint = "https://bids.mrh.gov.gh/";
  async fetchOpportunities() {
    enforceSourceRateLimit(this.slug, 6); const pages = [this.endpoint, `${this.endpoint}bids/browse?cat=category`, `${this.endpoint}bids/browse?cat=agency`, `${this.endpoint}bids/browse?cat=finding%20source`];
    const html = (await Promise.all(pages.map((url) => fetchWithRetry(url, { headers: { Accept: "text/html", "User-Agent": "BidScopeGhana/1.0" } }).then((response) => response.text())))).join("\n");
    const links = [...new Set([...html.matchAll(/href=["']([^"']*\/bids\/details\/\d+\/\d+)["']/gi)].map((item) => absolute(this.endpoint, item[1])))];
    return pooledMap(links, 2, async (url) => { const detailHtml = await (await fetchWithRetry(url, { headers: { Accept: "text/html", "User-Agent": "BidScopeGhana/1.0" } })).text(); return { id: url.split("/").slice(-2).join("-"), url, detailHtml, body: decode(detailHtml), documents: htmlDocumentLinks(url, detailHtml) }; });
  }
  async normaliseOpportunity(raw: Raw) { const body = String(raw.body); const title = match(String(raw.detailHtml), /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i) || body.slice(0, 300); const deadline = futureDate(body); const reference = body.match(/(?:Reference|Bid)\s*(?:No\.?|Number)?\s*[:.]\s*([A-Z0-9][A-Z0-9/.-]{5,})/i)?.[1] || String(raw.id); return normalize({ title, summary: body.slice(0, 1_000), description: body, buyer_name: "Ministry of Roads and Highways", country: "Ghana", country_code: "GH", sector: "Roads and transport", category: "works", deadline_at: deadline, source_name: "MRH e-Bids", source_type: "STRUCTURED_WEB", external_opportunity_id: String(raw.id), external_reference: reference, official_source_url: String(raw.url), official_tender_url: String(raw.url), official_submission_url: String(raw.url), submission_platform: "MRH e-Bids", submission_method: "Electronic or physical submission as stated in the official notice", requires_registration: true, registration_url: "https://bids.mrh.gov.gh/create-account", documents_url: (raw.documents as string[])[0] || String(raw.url), funding_source: body.match(/Funding Source:\s*([^.;]+)/i)?.[1] || "Government of Ghana", eligibility_text: body.match(/open to bidders[^.]*\./i)?.[0] || null, submission_instructions: body.match(/How To Bid([\s\S]{10,1500}?)(?=How to Purchase|$)/i)?.[1]?.trim() || null, source_details: { documents: raw.documents }, raw_payload: raw }); }
  getOfficialUrl(raw: Raw) { return String(raw.url || this.endpoint); }
}

export class GhanaHighwayAuthorityAdapter extends GhanaAdapter {
  readonly slug = "ghana-highway-authority"; private endpoint = "https://highways.gov.gh/tenders";
  async fetchOpportunities() { enforceSourceRateLimit(this.slug, 4); const html = await (await fetchWithRetry(this.endpoint, { headers: { Accept: "text/html", "User-Agent": "BidScopeGhana/1.0" } })).text(); const body = decode(html); return /invitation for bids|invitation for tenders|request for/i.test(body) ? [{ id: body.match(/Tender Reference No:\s*([^\s]+(?:\/[^\s]+)*)/i)?.[1] || "current", url: this.endpoint, html, body, documents: htmlDocumentLinks(this.endpoint, html) }] : []; }
  async normaliseOpportunity(raw: Raw) { const body = String(raw.body); const title = body.match(/(INVITATION FOR (?:BIDS|TENDERS)[\s\S]{0,250}?)(?=Date of Publication:)/i)?.[1]?.trim() || "Ghana Highway Authority procurement opportunity"; const deadline = futureDate(body); const documents = raw.documents as string[]; const fee = body.match(/Bidding Document Fee:\s*(?:USD|GHS|GH¢)\s*([\d,.]+)/i); return normalize({ title, summary: body.match(/Project Overview\s*([\s\S]{20,1500}?)(?=Key Bidding Information)/i)?.[1]?.trim() || body.slice(0, 1_000), description: body, buyer_name: body.match(/Employer:\s*([^\n]+?)(?=Funding Source:)/i)?.[1]?.trim() || "Ghana Highway Authority", country: "Ghana", country_code: "GH", sector: "Roads and transport", category: "works", procurement_method: body.match(/Procurement Method:\s*([^.;]+)/i)?.[1]?.trim() || null, published_at: firstDate(body.match(/Date of Publication:\s*([^\n]+?)(?=Tender Reference)/i)?.[1]), deadline_at: deadline, source_name: "Ghana Highway Authority", source_type: "STRUCTURED_WEB", external_opportunity_id: String(raw.id), external_reference: String(raw.id), official_source_url: this.endpoint, documents_url: documents[0] || this.endpoint, funding_source: body.match(/Funding Source:\s*([^\n]+?)(?=Project Overview)/i)?.[1]?.trim() || "Government of Ghana", eligibility_text: /international competitive/i.test(body) ? "International Competitive Bidding is stated in the official notice; bidders must satisfy all tender-specific qualification requirements." : null, eligibility_status: /international competitive/i.test(body) ? "INTERNATIONAL_ELIGIBLE" : "GHANA_ELIGIBLE", participation_fee_amount: fee ? number(fee[1]) : null, participation_fee_currency: fee ? (body.match(/Bidding Document Fee:\s*(USD|GHS|GH¢)/i)?.[1] === "USD" ? "USD" : "GHS") : null, bid_security_requirement: body.match(/Bid Security Required:\s*([^.;]+)/i)?.[1]?.trim() || null, submission_instructions: body.match(/Submission Venue:\s*([^.;]+)/i)?.[1]?.trim() || null, contact_address: "Ghana Highway Authority Head Office, Accra", contact_email: "ce@highways.gov.gh", contact_phone: "0303-967364", source_details: { documents }, raw_payload: raw }); }
  getOfficialUrl() { return this.endpoint; }
}

export class GhanaMinistryFinanceAdapter extends GhanaAdapter {
  readonly slug = "ghana-ministry-finance"; private endpoint = "https://www.mofep.gov.gh/adverts";
  async fetchOpportunities() {
    enforceSourceRateLimit(this.slug, 6); const pages = [this.endpoint, `${this.endpoint}?page=1`]; const pageHtml = await Promise.all(pages.map((url) => fetchWithRetry(url, { headers: { Accept: "text/html", "User-Agent": "BidScopeGhana/1.0" } }).then((response) => response.text())));
    const links = [...new Set(pageHtml.flatMap((html) => [...html.matchAll(/href=["']([^"']*\/adverts\/20\d{2}-\d{2}-\d{2}\/[^"'#?]+)["']/gi)].map((item) => absolute(this.endpoint, item[1]))))].filter((url) => !/cancel|public-input/i.test(url)).slice(0, 20);
    return pooledMap(links, 3, async (url) => { const html = await (await fetchWithRetry(url, { headers: { Accept: "text/html", "User-Agent": "BidScopeGhana/1.0" } })).text(); return { id: url, url, html, body: decode(html), documents: htmlDocumentLinks(url, html) }; });
  }
  async normaliseOpportunity(raw: Raw) { const body = String(raw.body); const title = match(String(raw.html), /<h1[^>]*>([\s\S]*?)<\/h1>/i) || body.slice(0, 300); if (!/tender|proposal|expression of interest|procurement|consult/i.test(`${title} ${body}`)) throw new Error("Non-procurement Ministry of Finance advert"); const deadline = futureDate(body); const reference = title.match(/\(([A-Z0-9][A-Z0-9/_. -]{5,})\)/i)?.[1]?.trim() || body.match(/(?:Reference|IFQ|Contract)\s*(?:No\.?|Number)?\s*[:.]?\s*([A-Z0-9][A-Z0-9/_.-]{5,})/i)?.[1] || String(raw.id); const documents = raw.documents as string[]; const requirements = body.match(/(?:mandatory|required|must provide|must include)[\s\S]{0,3000}?(?=(?:DURATION|DEADLINE|SUBMISSION|Further information)\b)/i)?.[0]?.trim() || null; return normalize({ title, summary: body.match(/(?:BACKGROUND|OBJECTIVE|The Ministry)[\s\S]{20,1400}?(?=(?:The Ministry|Interested|Consultants|It is mandatory|DURATION)\b)/i)?.[0]?.trim() || body.slice(0, 1_000), description: body, buyer_name: "Ministry of Finance, Ghana", buyer_type: "Central government", country: "Ghana", country_code: "GH", category: /consult|expression of interest/i.test(title) ? "consulting" : category(title), procurement_method: body.match(/(?:Selection|Tendering) (?:Method|will be conducted)[\s\S]{0,150}?\b(QCBS|CQS|NCT|ICB|Quality[^.;]+)/i)?.[1] || null, contract_type: /expression of interest/i.test(title) ? "Expression of Interest" : /request for proposal/i.test(title) ? "Request for Proposal" : "Procurement notice", published_at: firstDate(String(raw.url).match(/\/adverts\/(20\d{2}-\d{2}-\d{2})\//)?.[1]), deadline_at: deadline, source_name: "Ministry of Finance, Ghana", source_type: "STRUCTURED_WEB", external_opportunity_id: String(raw.id), external_reference: reference, official_source_url: String(raw.url), documents_url: documents[0] || String(raw.url), funding_source: body.match(/(?:financing|funding) (?:from|source)\s*([^.;]+)/i)?.[1]?.trim() || "Government of Ghana", eligibility_text: requirements, qualification_requirements: requirements, submission_instructions: body.match(/(?:SUBMISSION OF EXPRESSIONS OF INTEREST|DEADLINE FOR SUBMISSION)([\s\S]{20,1500}?)(?=attachment|Search Quick Links|$)/i)?.[1]?.trim() || null, contact_email: body.match(/[A-Z0-9._%+-]+@mofep\.gov\.gh/i)?.[0] || "info@mofep.gov.gh", contact_phone: body.match(/(?:Tel|Telephone)\s*[:.]?\s*([+\d ()-]{7,})/i)?.[1]?.trim() || "+233 302 747 197", contact_address: "Ministry of Finance, Tumu Avenue, Kanda, Accra, Ghana", source_details: { documents }, raw_payload: raw }); }
  getOfficialUrl(raw: Raw) { return String(raw.url || this.endpoint); }
}
