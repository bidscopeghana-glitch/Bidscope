import { stripImportedHtml } from "./safety.ts";

export type GuestOpportunityInput = {
  slug: string; title: string; summary?: string | null; buyer_name?: string | null; source_name?: string | null;
  country?: string | null; country_code?: string | null; region?: string | null; sector?: string | null;
  category?: string | null; published_at?: string | null; deadline_at?: string | null; status?: string | null;
  estimated_value?: number | null; currency?: string | null; contract_type?: string | null; procurement_method?: string | null;
};

function escapePattern(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export function redactGuestText(value: string | null | undefined, hiddenTerms: Array<string | null | undefined>, maximum = 280) {
  let output = stripImportedHtml(value || "", maximum * 3)
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
    .replace(/(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?){2,5}\d{3,}/g, "");
  for (const term of hiddenTerms.filter((item): item is string => Boolean(item?.trim())).sort((a, b) => b.length - a.length)) {
    output = output.replace(new RegExp(escapePattern(term.trim()), "gi"), "the issuing authority");
  }
  output = output.replace(/\b(?:GHANEPS|SAM\.gov|UNGM|TED|Contracts Finder|Find a Tender)\b/gi, "the procurement portal").replace(/\s+/g, " ").trim();
  return output.length > maximum ? `${output.slice(0, maximum).replace(/\s+\S*$/, "").trim()}…` : output;
}

export function guestOpportunityPreview(input: GuestOpportunityInput) {
  const hiddenTerms = [input.source_name, input.buyer_name];
  return {
    slug: input.slug,
    title: redactGuestText(input.title, hiddenTerms, 180) || "Public procurement opportunity",
    summary: redactGuestText(input.summary, hiddenTerms, 360) || "A public-sector opportunity is available in this category. Create an account to review the verified scope and requirements.",
    teaser: "Create an account to review the available scope, buyer, requirements, source documents and application route.",
    country: input.country || null,
    country_code: input.country_code || null,
    region: input.region || null,
    sector: input.sector || null,
    category: input.category || "other",
    published_at: input.published_at || null,
    deadline_at: input.deadline_at || null,
    status: input.status || "OPEN",
    estimated_value: input.estimated_value ?? null,
    currency: input.currency || null,
    contract_type: input.contract_type || null,
    procurement_method: input.procurement_method || null,
    buyer_type: "Public-sector organisation",
    documents_available: false,
    intelligence_available: false,
    bidscope_reference: `BS-${input.country_code || "INT"}-${input.slug.slice(0, 8).toUpperCase()}`,
    access: "preview" as const,
    locked: ["buyer", "source", "reference", "full_scope", "eligibility", "requirements", "documents", "contacts", "application_route"],
  };
}
