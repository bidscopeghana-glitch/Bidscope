import { normalize } from "../procurement/normalization.ts";
import { stableHash } from "../procurement/safety.ts";
import type { NormalizedOpportunity } from "../procurement/types.ts";

export const GHANEPS_REGISTRY_URL = "https://data.open-contracting.org/en/publication/85";
export const GHANEPS_DATASET_URL = `${GHANEPS_REGISTRY_URL}/download?name=full.jsonl.gz`;
export const GHANEPS_ORIGINAL_BASE = "https://www.ghaneps.gov.gh/epps/cft/prepareViewCfTWS.do?resourceId=";
type Json = Record<string, unknown>;
type Release = Json & { ocid: string; id: string; date?: string; tag?: string[] };

const object = (value: unknown): Json => value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const string = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const validDate = (value: unknown): string | null => { const raw = string(value); const date = raw ? new Date(raw) : null; return date && Number.isFinite(date.valueOf()) ? date.toISOString() : null; };
const url = (value: unknown): string | null => { try { const u = new URL(string(value)); return u.protocol === "https:" ? u.href : null; } catch { return null; } };

export function extractReleases(input: unknown): Release[] {
  const root = object(input);
  const candidates = Array.isArray(root.records)
    ? list(root.records).flatMap(record => { const r = object(record); return [...list(r.releases), ...list(r.compiledRelease ? [r.compiledRelease] : [])]; })
    : Array.isArray(root.releases) ? list(root.releases) : [root];
  return candidates.map(object).filter((r): r is Release => /^ocds-[a-z0-9-]+$/i.test(string(r.ocid)) && Boolean(string(r.id)));
}

export function latestReleases(releases: Release[]): Release[] {
  const byId = new Map<string, Release>();
  for (const release of releases) byId.set(`${release.ocid}\u0000${release.id}`, release);
  return [...byId.values()].sort((a, b) => (validDate(a.date) || "").localeCompare(validDate(b.date) || "") || a.id.localeCompare(b.id));
}

export function classifyOcds(releases: Release[], now = new Date()) {
  const ordered = latestReleases(releases);
  const current = ordered.at(-1);
  if (!current) throw new Error("No valid OCDS release");
  const tender = object(current.tender);
  const tags = ordered.flatMap(release => list(release.tag).map(string));
  const end = validDate(object(tender.tenderPeriod).endDate);
  const tenderStatus = string(tender.status).toLowerCase();
  const hasContract = ordered.some(r => list(r.contracts).length > 0) || tags.some(t => /^contract|implementation/i.test(t));
  const hasAward = ordered.some(r => list(r.awards).length > 0) || tags.some(t => /^award/i.test(t));
  const cancelled = tenderStatus === "cancelled" || tags.includes("tenderCancellation");
  const stage = hasContract ? "contracted" : hasAward ? "awarded" : cancelled ? "cancelled" : tenderStatus === "planned" || tags.includes("planning") ? "planned" : "tender";
  const status: NormalizedOpportunity["status"] = cancelled ? "CANCELLED" : hasAward || hasContract ? "AWARDED" : stage === "planned" ? "UPCOMING" : end && new Date(end) > now && tenderStatus === "active" ? "OPEN" : end ? "CLOSED" : "UNKNOWN";
  return { current, ordered, stage, status, deadline: end };
}

export function ocdsToOpportunity(releases: Release[], now = new Date()): NormalizedOpportunity {
  const { current, ordered, stage, status, deadline } = classifyOcds(releases, now);
  const tender = object(current.tender);
  const buyer = object(tender.procuringEntity || current.buyer);
  const parties = list(current.parties).map(object);
  const buyerParty = parties.find(p => string(p.id) === string(buyer.id)) || {};
  const contact = object(buyerParty.contactPoint);
  const address = object(buyerParty.address);
  const docs = list(tender.documents).map(object);
  const sourceId = string(tender.id);
  const original = sourceId ? `${GHANEPS_ORIGINAL_BASE}${encodeURIComponent(sourceId)}` : GHANEPS_REGISTRY_URL;
  const docUrl = docs.map(d => url(d.url)).find(Boolean) || null;
  const category = string(tender.mainProcurementCategory).toLowerCase();
  const value = object(tender.value);
  const amount = Number(value.amount);
  const first = ordered[0];
  return normalize({
    title: string(tender.title) || `Procurement process ${current.ocid}`,
    summary: string(tender.description), description: string(tender.description),
    buyer_name: string(buyer.name), buyer_type: null, country: "Ghana", country_code: "GH",
    region: string(address.locality) || null,
    category: category === "goods" || category === "works" || category === "services" ? category : "other",
    procurement_method: string(tender.procurementMethodDetails || tender.procurementMethod) || null,
    currency: /^[A-Z]{3}$/.test(string(value.currency)) ? string(value.currency) : null,
    estimated_value: Number.isFinite(amount) && amount >= 0 ? amount : null,
    published_at: validDate(object(tender.tenderPeriod).startDate) || validDate(first.date),
    deadline_at: deadline, status, notice_stage: stage === "planned" ? "PLANNED" : stage === "awarded" || stage === "contracted" ? "AWARD" : status === "OPEN" ? "OPEN" : "OTHER",
    source_name: "GHANEPS / Public Procurement Authority Ghana", source_type: "official_open_data",
    external_opportunity_id: current.ocid, external_reference: sourceId || current.ocid,
    source_resource_id: sourceId || null, official_source_url: original, official_tender_url: original,
    official_submission_url: null, submission_platform: "GHANEPS", submission_method: list(tender.submissionMethod).map(string).filter(Boolean).join(", ") || null,
    requires_registration: false, registration_url: null, funding_source: "Other",
    eligibility_text: string(tender.eligibilityCriteria) || null, documents_url: docUrl,
    contact_name: string(contact.name) || null, contact_email: string(contact.email) || null,
    contact_phone: string(contact.telephone) || null, contact_address: string(address.streetAddress) || null,
    clarification_deadline_at: validDate(object(tender.enquiryPeriod).endDate),
    procurement_codes: list(tender.items).map(item => string(object(object(item).classification).id)).filter(Boolean),
    lots: list(tender.lots).map(object),
    source_details: { ocid: current.ocid, release_id: current.id, tender_id: sourceId || null, buyer_id: string(buyer.id) || null,
      current_stage: stage, registry_url: GHANEPS_REGISTRY_URL, release_count: ordered.length,
      first_seen_at: validDate(first.date), latest_release_date: validDate(current.date),
      documents: docs.map(d => ({ title: string(d.title), documentType: string(d.documentType), description: string(d.description), url: url(d.url), format: string(d.format), datePublished: validDate(d.datePublished), dateModified: validDate(d.dateModified), language: string(d.language) })),
      awards: list(current.awards), contracts: list(current.contracts), award_criteria: string(tender.awardCriteria), initiation_type: string(current.initiationType), planning: object(current.planning), implementation: object(current.implementation) },
    last_source_update: validDate(current.date), last_verified_at: now.toISOString(),
    raw_source_hash: stableHash(current), document_fingerprint: stableHash([current.ocid]),
    raw_payload: { ocid: current.ocid, release_id: current.id, registry_url: GHANEPS_REGISTRY_URL },
  });
}

/** A process is one OCID, never one row per release. No attachment bytes are copied. */
export function ocdsToHistory(releases: Release[], sourceId: string, runId: string | null, now = new Date()) {
  const { current, ordered, stage, status } = classifyOcds(releases, now);
  const tender = object(current.tender);
  const buyer = object(tender.procuringEntity || current.buyer);
  const awards = ordered.flatMap(release => list(release.awards).map(object));
  const contracts = ordered.flatMap(release => list(release.contracts).map(object));
  const byId = (items: Json[]) => [...new Map(items.map(item => [string(item.id) || stableHash(item), item])).values()];
  const uniqueAwards = byId(awards);
  const uniqueContracts = byId(contracts);
  const suppliers = [...new Set(uniqueAwards.flatMap(award => list(award.suppliers).map(item => string(object(item).name)).filter(Boolean)))];
  const value = object(tender.value);
  const amount = Number(value.amount);
  const monetary = (items: Json[]) => {
    const amounts = items.map(item => object(item.value)).filter(item => Number.isFinite(Number(item.amount)) && Number(item.amount) >= 0 && /^[A-Z]{3}$/.test(string(item.currency)));
    const currencies = [...new Set(amounts.map(item => string(item.currency)))];
    return currencies.length === 1 ? { amount: amounts.reduce((total, item) => total + Number(item.amount), 0), currency: currencies[0] } : { amount: null, currency: null };
  };
  const contractMoney = monetary(uniqueContracts);
  const awardMoney = monetary(uniqueAwards);
  const first = ordered[0];
  const sourceTenderId = string(tender.id);
  const documents = ordered.flatMap(release => list(object(release.tender).documents).map(object));
  return {
    source_id: sourceId, ocid: current.ocid, source_hash: stableHash(ordered),
    latest_release_id: current.id, latest_release_date: validDate(current.date),
    first_publication_date: validDate(first.date),
    title: string(tender.title) || `Procurement process ${current.ocid}`,
    description: string(tender.description) || null,
    buyer_name: string(buyer.name) || null, buyer_id: string(buyer.id) || null,
    category: string(tender.mainProcurementCategory) || null,
    procurement_method: string(tender.procurementMethodDetails || tender.procurementMethod) || null,
    tender_id: sourceTenderId || null,
    tender_start_at: validDate(object(tender.tenderPeriod).startDate),
    tender_end_at: validDate(object(tender.tenderPeriod).endDate), stage, status,
    value: Number.isFinite(amount) && amount >= 0 ? amount : null,
    currency: /^[A-Z]{3}$/.test(string(value.currency)) ? string(value.currency) : null,
    contract_value: contractMoney.amount, contract_currency: contractMoney.currency,
    award_value: awardMoney.amount, award_currency: awardMoney.currency,
    award_count: uniqueAwards.length, contract_count: uniqueContracts.length,
    supplier_names: suppliers, award_data: uniqueAwards, contract_data: uniqueContracts,
    parties: list(current.parties),
    documents_metadata: byId(documents).map(doc => ({ id: string(doc.id), title: string(doc.title), documentType: string(doc.documentType), url: url(doc.url), datePublished: validDate(doc.datePublished), dateModified: validDate(doc.dateModified), format: string(doc.format) })),
    release_history: ordered,
    original_source_url: sourceTenderId ? `${GHANEPS_ORIGINAL_BASE}${encodeURIComponent(sourceTenderId)}` : null,
    registry_url: GHANEPS_REGISTRY_URL,
    source_attribution: "GHANEPS / Public Procurement Authority Ghana",
    last_seen_at: now.toISOString(), last_import_run_id: runId,
  };
}
