import type { NormalizedOpportunity } from "./types.ts";
import { stableHash } from "./safety.ts";

function canonical(value: string | null | undefined) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function deduplicationKeys(record: NormalizedOpportunity) {
  return [
    record.external_reference ? `reference:${canonical(record.external_reference)}` : null,
    record.document_fingerprint ? `document:${record.document_fingerprint}` : null,
    `composite:${stableHash([canonical(record.buyer_name), canonical(record.title), record.deadline_at?.slice(0, 10) || "", record.estimated_value])}`,
  ].filter((value): value is string => Boolean(value));
}
