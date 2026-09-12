export type AlertRuleRecord = {
  id: string;
  keywords: string[];
  excluded_keywords: string[];
  categories: string[];
  sectors: string[];
  regions: string[];
  buyer_ids: string[];
  minimum_value: number | null;
  maximum_value: number | null;
  deadline_days_min: number | null;
  deadline_days_max: number | null;
  email_recipients: string[];
};

export type AlertOpportunityRecord = {
  id: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  sector: string | null;
  region: string | null;
  buyer_normalized_id: string | null;
  estimated_value: number | null;
  deadline_at: string | null;
  slug: string;
  official_source_url: string;
};

const normalized = (value: string | null | undefined) => (value || "").trim().toLowerCase();

export function matchesAlert(rule: AlertRuleRecord, opportunity: AlertOpportunityRecord, now = new Date()) {
  const haystack = normalized(`${opportunity.title} ${opportunity.summary} ${opportunity.description} ${opportunity.sector || ""} ${opportunity.region || ""}`);
  if (rule.keywords.length && !rule.keywords.some((word) => haystack.includes(normalized(word)))) return false;
  if (rule.excluded_keywords.some((word) => haystack.includes(normalized(word)))) return false;
  if (rule.categories.length && !rule.categories.includes(opportunity.category)) return false;
  if (rule.sectors.length && !rule.sectors.some((sector) => normalized(opportunity.sector).includes(normalized(sector)))) return false;
  if (rule.regions.length && !rule.regions.map(normalized).includes(normalized(opportunity.region))) return false;
  if (rule.buyer_ids.length && (!opportunity.buyer_normalized_id || !rule.buyer_ids.includes(opportunity.buyer_normalized_id))) return false;
  if (rule.minimum_value != null && (opportunity.estimated_value == null || opportunity.estimated_value < rule.minimum_value)) return false;
  if (rule.maximum_value != null && (opportunity.estimated_value == null || opportunity.estimated_value > rule.maximum_value)) return false;
  if (rule.deadline_days_min != null || rule.deadline_days_max != null) {
    if (!opportunity.deadline_at) return false;
    const days = Math.ceil((new Date(opportunity.deadline_at).getTime() - now.getTime()) / 86_400_000);
    if (rule.deadline_days_min != null && days < rule.deadline_days_min) return false;
    if (rule.deadline_days_max != null && days > rule.deadline_days_max) return false;
  }
  return true;
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}
