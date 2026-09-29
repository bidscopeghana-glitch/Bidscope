export function formatTenderFact(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not published by the issuing authority";
  if (Array.isArray(value)) return value.map(formatTenderFact).filter(Boolean).join("; ");
  if (typeof value === "object") {
    const fields = Object.entries(value).filter(([, item]) => item !== null && item !== undefined && item !== "");
    if (!fields.length) return "Not published by the issuing authority";
    const name = fields.find(([key]) => key === "name")?.[1];
    const evidence = fields.find(([key]) => key === "evidence")?.[1];
    if (typeof name === "string") return evidence ? `${name} — ${formatTenderFact(evidence)}` : name;
    return fields.map(([key, item]) => `${key.replaceAll("_", " ")}: ${formatTenderFact(item)}`).join("; ");
  }
  return String(value);
}

export function displayableSourceFact(key: string, value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (/^evaluation\s+criteria$/i.test(key.trim()) && /participation\s+fee\s+required/i.test(String(value))) return false;
  if (key === "Contract Notice Date") {
    return /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{4}-\d{1,2}-\d{1,2})\b/.test(String(value));
  }
  return true;
}

export function formatSourceFact(key: string, value: unknown): string {
  if (key === "Procurement Method") return formatTenderFact(value).split(/\s+Includes eAuction\s*:/i)[0].trim();
  if (key === "Contract Notice Date") {
    const date = String(value ?? "").match(/\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{4}-\d{1,2}-\d{1,2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?\b/);
    return date?.[0] ?? "Not published by the issuing authority";
  }
  return formatTenderFact(value);
}
