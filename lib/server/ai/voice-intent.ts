/** A deliberately small, deterministic dispatcher. The model never chooses an API or SQL query. */
export type VoiceIntent =
  | { kind: "search"; term: string; country?: string }
  | { kind: "tender_evaluation" }
  | { kind: "subscription" }
  | { kind: "verification" }
  | { kind: "notifications" }
  | { kind: "reception"; desk: "human" | "buyer" | "supplier" | "plans" | "meetings" }
  | { kind: "write_request" }
  | { kind: "help" };

export function classifyVoiceIntent(question: string): VoiceIntent {
  const value = question.toLowerCase().replace(/\s+/g, " ").trim();
  if (/\b(?:human|person|your team|customer service|support agent|reception|contact bidscope)\b/.test(value)) return { kind: "reception", desk: "human" };
  if (/\b(?:save|unsave|bookmark|watch|remind|submit|publish|delete|send|schedule|create|add|set up|turn on|turn off)\b.{0,45}\b(?:tender|alert|reminder|bid|ticket|meeting|document|message|opportunity)\b/.test(value)) {
    return { kind: "write_request" };
  }
  if (/^how (?:do|can) (?:i|we)\b/.test(value) && !/\b(?:tender|qualify|eligible|mandatory|bid security)\b/.test(value)) return { kind: "help" };
  if (/\b(?:my|our)\b.{0,30}\b(?:subscription|plan|allowance|billing)\b/.test(value)) return { kind: "subscription" };
  if (/\b(?:my|our)\b.{0,30}\b(?:verification|verified|credentials)\b/.test(value)) return { kind: "verification" };
  if (/\b(?:my|our)\b.{0,30}\b(?:notifications|alerts)\b/.test(value)) return { kind: "notifications" };
  if (/\b(?:buyer desk|buyer account|procurement team|manage my tenders)\b/.test(value)) return { kind: "reception", desk: "buyer" };
  if (/\b(?:supplier desk|seller account|supplier workspace)\b/.test(value)) return { kind: "reception", desk: "supplier" };
  if (/\b(?:prices|pricing|which plan|compare plans)\b/.test(value)) return { kind: "reception", desk: "plans" };
  if (/\b(?:meeting|calendar|appointment)\b/.test(value)) return { kind: "reception", desk: "meetings" };
  if (/\b(?:find|search|show|list|look for|what are)\b.{0,85}\b(?:tenders?|opportunities?)\b/.test(value)
      || /\b(?:tenders?|opportunities?)\b.{0,60}\b(?:available|open|closing)\b/.test(value)) {
    const countries: Record<string, string> = {
      ghana: "GH", nigeria: "NG", kenya: "KE", "south africa": "ZA", uganda: "UG",
      tanzania: "TZ", "ivory coast": "CI", "côte d’ivoire": "CI", togo: "TG",
      benin: "BJ", senegal: "SN", rwanda: "RW", zambia: "ZM", "united kingdom": "GB",
    };
    const country = Object.entries(countries).find(([name]) => value.includes(name))?.[1];
    const term = value
      .replace(/\b(?:find|search|show|list|look for|what are|me|all|any|available|open|new|current|the|please|tenders?|opportunities?|for|in|on|about|ghanaian|ghana|nigeria|kenya|south africa|uganda|tanzania|ivory coast|côte d’ivoire|togo|benin|senegal|rwanda|zambia|united kingdom)\b/g, " ")
      .replace(/[^a-z0-9 -]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
    return { kind: "search", term, ...(country ? { country } : {}) };
  }
  if (/\b(?:qualify|eligible|requirements?|mandatory|bid security|disqualif|analyse|analyze|evaluate|explain this tender|documents? missing|bid or no.bid)\b/.test(value)) {
    return { kind: "tender_evaluation" };
  }
  return { kind: "help" };
}
