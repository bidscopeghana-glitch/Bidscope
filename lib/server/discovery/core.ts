import { parseDate, stableHash, stripImportedHtml } from "../procurement/safety.ts";

export type CrawlRecord = { url: string; status: string; markdown?: string; html?: string; metadata?: { title?: string; url?: string; status?: number } };
export type ExtractedDiscovery = {
  title: string | null; buyer: string | null; reference: string | null;
  description: string | null; deadline: string | null; published: string | null;
  category: "goods" | "works" | "services" | "consulting" | null;
  documentUrls: string[]; eligibility: string | null; contactEmail: string | null;
  confidence: number;
};
export type TenderCandidate = { id: string; title: string; buyer_name: string; external_reference: string | null; official_source_url: string; deadline_at: string | null; description?: string | null; category?: string | null };

export function canonicalUrl(input: string): string {
  const url = new URL(input);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Crawl URL must be HTTP(S).");
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$)/i.test(key)) url.searchParams.delete(key);
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  url.searchParams.sort();
  return url.toString();
}

export function normalizedWords(input: string | null | undefined): string[] {
  return (input || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ").replace(/\b(limited|ltd|incorporated|inc|plc)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
}

function similarity(a: string | null | undefined, b: string | null | undefined): number {
  const left = new Set(normalizedWords(a));
  const right = new Set(normalizedWords(b));
  if (!left.size || !right.size) return 0;
  const shared = [...left].filter(word => right.has(word)).length;
  return shared / new Set([...left, ...right]).size;
}

export function contentHash(record: CrawlRecord): string {
  return stableHash((record.markdown || stripImportedHtml(record.html || "", 200_000)).replace(/\s+/g, " ").trim());
}

function noticeDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = parseDate(value);
  if (!parsed) return null;
  if (!/\d{1,2}:\d{2}|T\d{2}:\d{2}/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.valueOf())) return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString();
  }
  return parsed;
}

export function extractDiscovery(record: CrawlRecord): ExtractedDiscovery {
  const body = (record.markdown || stripImportedHtml(record.html || "", 100_000)).slice(0, 100_000);
  const line = (pattern: RegExp) => body.match(pattern)?.[1]?.trim().slice(0, 1000) || null;
  const title = (record.metadata?.title || body.match(/^#{1,3}\s+(.+)$/m)?.[1] || "").trim().slice(0, 500) || null;
  const buyer = line(/(?:procuring entity|contracting authority|issuing (?:organisation|organization)|buyer|client)\s*[:\-]\s*([^\n]+)/i);
  const reference = line(/(?:tender|procurement|rfp|rfq|bid)\s*(?:no\.?|number|reference|ref\.?)\s*[:#\-]\s*([A-Z0-9][A-Z0-9/_-]{3,})/i);
  const deadline = noticeDate(line(/(?:closing|submission|bid)\s*(?:date|deadline|time)\s*[:\-]\s*([^\n]+)/i));
  const published = noticeDate(line(/(?:publication|published|issue)\s*date\s*[:\-]\s*([^\n]+)/i));
  const category = /\b(construction|civil works|rehabilitation|renovation)\b/i.test(body) ? "works" : /\b(consultancy|consulting)\b/i.test(body) ? "consulting" : /\b(supply|purchase|equipment|goods)\b/i.test(body) ? "goods" : /\b(services|maintenance)\b/i.test(body) ? "services" : null;
  const eligibility = line(/(?:eligibility|eligible bidders?|qualification requirements?)\s*[:\-]\s*([^\n]+)/i);
  const contactEmail = body.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null;
  const documentUrls = [...body.matchAll(/https?:\/\/[^\s)\]>"']+\.(?:pdf|docx?)(?:\?[^\s)\]>"']*)?/gi)].map(match => match[0]).slice(0, 20);
  const description = body.trim().slice(0, 20_000) || null;
  const confidence = Number(Math.min(1, [title, buyer, reference, deadline, published, category, eligibility, contactEmail, documentUrls.length ? true : null].filter(Boolean).length / 9).toFixed(3));
  return { title, buyer, reference, description, deadline, published, category, documentUrls, eligibility, contactEmail, confidence };
}

export function classifyDuplicate(discovery: ExtractedDiscovery, url: string, candidates: TenderCandidate[]) {
  let best: { status: "unique" | "exact_duplicate" | "probable_duplicate" | "possible_duplicate"; matchId: string | null; score: number } = { status: "unique", matchId: null, score: 0 };
  for (const candidate of candidates) {
    if (discovery.reference && candidate.external_reference && discovery.reference.toLowerCase() === candidate.external_reference.toLowerCase())
      return { status: "exact_duplicate" as const, matchId: candidate.id, score: 1 };
    if (canonicalUrl(url) === canonicalUrl(candidate.official_source_url))
      return { status: "exact_duplicate" as const, matchId: candidate.id, score: 1 };
    const title = similarity(discovery.title, candidate.title);
    const buyer = similarity(discovery.buyer, candidate.buyer_name);
    const deadline = discovery.deadline && candidate.deadline_at && discovery.deadline.slice(0, 10) === candidate.deadline_at.slice(0, 10) ? 1 : 0;
    const description = similarity(discovery.description?.slice(0, 500), candidate.description?.slice(0, 500));
    const category = discovery.category && candidate.category === discovery.category ? 1 : 0;
    const score = Number((0.52 * title + 0.25 * buyer + 0.12 * deadline + 0.07 * description + 0.04 * category).toFixed(3));
    if (score > best.score) best = { status: score >= 0.72 ? "probable_duplicate" : score >= 0.58 ? "possible_duplicate" : "unique", matchId: score >= 0.58 ? candidate.id : null, score };
  }
  return best;
}

export function reviewReason(extracted: ExtractedDiscovery, now = new Date()): string | null {
  if (!extracted.title || !extracted.buyer || !extracted.deadline) return "Missing title, buyer or explicit deadline.";
  if (!/\b(tender|bid|procurement|request for|quotation|proposal|supply|construction|consultancy|services)\b/i.test(`${extracted.title} ${extracted.description?.slice(0, 1000)}`)) return "Procurement intent is not clear.";
  if (Date.parse(extracted.deadline) < now.getTime()) return "Deadline has expired.";
  return null;
}
