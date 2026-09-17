import { stripImportedHtml } from "./safety.ts";
import type { NormalizedOpportunity } from "./types.ts";

function useful(value: string | null | undefined) {
  const clean = stripImportedHtml(value || "", 50_000);
  return clean && !/^https?:\/\/\S+$/i.test(clean) ? clean : "";
}

function evidence(text: string, expressions: RegExp[], maximum = 2_000) {
  for (const expression of expressions) {
    const match = text.match(expression)?.[0];
    if (match) return match.replace(/\s+/g, " ").trim().slice(0, maximum);
  }
  return null;
}

function amount(text: string, label: RegExp) {
  const match = text.match(new RegExp(`${label.source}[\\s\\S]{0,100}?(GHS|GH¢|USD|EUR|GBP)?\\s*([\\d,.]+)`, "i"));
  const value = Number(match?.[2]?.replaceAll(",", ""));
  return Number.isFinite(value) && value > 0 ? { value, currency: match?.[1]?.replace("GH¢", "GHS") || null } : null;
}

function duration(text: string) {
  return text.match(/(?:contract|completion|completed|duration|delivery period)[^.;]{0,80}?((?:\d+[\s-]*)?(?:calendar\s+)?(?:days?|weeks?|months?|years?))/i)?.[1]?.trim() || null;
}

function requiredDocumentNames(text: string) {
  const names = [
    "Tax Clearance Certificate", "SSNIT Clearance Certificate", "business registration certificate", "VAT registration certificate",
    "tender security", "bid security", "bid-securing declaration", "power of attorney", "beneficial ownership disclosure",
    "technical proposal", "financial proposal", "method statement", "work programme", "audited financial statements",
    "Bill of Quantities", "environmental and social management plan", "sexual exploitation and abuse declaration", "sexual harassment declaration",
  ];
  const mandatoryContext = evidence(text, [/(?:must|shall|required to|accompanied by|include|submit|provide)[\s\S]{0,2400}/i], 2_400) || "";
  return names.filter((name) => new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(mandatoryContext)).map((name) => ({ name, evidence: "Explicitly referenced in the published requirement text" }));
}

export function enrichNormalizedOpportunity(input: NormalizedOpportunity): NormalizedOpportunity {
  const summary = useful(input.summary); const description = useful(input.description);
  const sourceText = Object.values(input.source_details || {}).filter((value) => typeof value === "string").join(" ");
  const text = `${summary} ${description} ${sourceText}`.replace(/\s+/g, " ").trim().slice(0, 120_000);
  const qualification = input.qualification_requirements || evidence(text, [
    /(?:qualification requirements?|minimum eligibility requirements?|selection criteria|bidders? (?:must|shall|required to))[:\s][\s\S]{20,2200}?(?=(?:submission|deadline|bid security|tender security|how to apply|$))/i,
    /(?:open to all eligible|invites? (?:sealed )?(?:bids|tenders) from eligible)[\s\S]{0,900}/i,
  ]);
  const publishedEligibility = evidence(text, [
    /(?:open to all eligible|eligible (?:and qualified )?(?:bidders|tenderers|firms)|participation is (?:open|restricted)|only (?:registered|prequalified|invited))[\s\S]{0,1200}?(?=(?:submission|deadline|documents?|bid security|$))/i,
  ]);
  const submission = input.submission_instructions || evidence(text, [
    /(?:bids?|tenders?|proposals?|expressions? of interest) (?:must|shall) be (?:submitted|delivered)[\s\S]{0,1800}?(?=(?:late bids|bids? will be opened|bid security|$))/i,
    /(?:electronic (?:submission|bidding)|submission (?:method|portal|address))[:\s][\s\S]{10,1200}/i,
  ]);
  const security = input.bid_security_text || input.bid_security_requirement || evidence(text, [/(?:all )?(?:bids|tenders) must be accompanied by (?:a )?(?:bid|tender)[ -]secur[^.]{0,500}/i, /(?:bid|tender) security[:\s][^.]{3,500}/i]);
  const fee = input.participation_fee_amount ? null : amount(text, /(?:participation fee|tender fee|non-refundable fee|bidding document fee)/i);
  const validity = input.bid_validity_days || Number(text.match(/(?:bid|tender) validity[^\d]{0,60}(\d{1,4})\s*days?/i)?.[1] || 0) || null;
  const email = input.contact_email || text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null;
  const phone = input.contact_phone || text.match(/(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?){2,5}\d{3,}/)?.[0]?.trim() || null;
  const evaluation = evidence(text, [/(?:evaluation (?:mechanism|method|criteria)|award criteria)[:\s][\s\S]{5,1200}?(?=(?:submission|deadline|qualification|$))/i, /(?:lowest evaluated|most economically advantageous)[^.]{0,600}/i]);
  const contractDuration = duration(text);
  const registrationEvidence = evidence(text, [/(?:must|required to|shall) (?:first )?(?:register|be registered)[^.]{0,500}/i, /registration (?:is )?required[^.]{0,400}/i]);
  const documents = input.required_documents?.length ? input.required_documents : requiredDocumentNames(text);
  const sourceDetails = { ...(input.source_details || {}), ...(contractDuration && !input.source_details?.["Contract duration"] ? { "Contract duration": contractDuration } : {}), ...(evaluation && !input.source_details?.["Evaluation criteria"] ? { "Evaluation criteria": evaluation } : {}), ...(registrationEvidence ? { "Registration evidence": registrationEvidence } : {}) };
  const eligibilityText = input.eligibility_text && !/eligibility (?:must|is to be) (?:verified|checked)|not assumed/i.test(input.eligibility_text) ? input.eligibility_text : publishedEligibility || input.eligibility_text;
  const enriched = {
    ...input,
    summary: summary || description.slice(0, 1_000), description: description || summary,
    eligibility_text: eligibilityText || null, qualification_requirements: qualification || null,
    submission_instructions: submission || null, bid_security_requirement: security || null, bid_security_text: security || null,
    bid_validity_days: validity, participation_fee_amount: input.participation_fee_amount || fee?.value || null,
    participation_fee_currency: input.participation_fee_currency || fee?.currency || null,
    contact_email: email, contact_phone: phone, required_documents: documents, source_details: sourceDetails,
  } satisfies NormalizedOpportunity;
  const signals = [enriched.description.length >= 250, enriched.deadline_at, enriched.external_reference, enriched.procurement_method, enriched.documents_url, enriched.contact_email || enriched.contact_phone, enriched.eligibility_text, enriched.submission_instructions, enriched.qualification_requirements, enriched.bid_security_requirement, enriched.participation_fee_amount, Object.keys(enriched.source_details).length >= 3].filter(Boolean).length;
  return { ...enriched, quality_score: Math.min(100, 40 + signals * 5) };
}
