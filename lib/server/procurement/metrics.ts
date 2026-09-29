import type { NormalizedOpportunity } from "./types.ts";

export function countGhanaOpportunities(records: readonly NormalizedOpportunity[]): number {
  return records.filter((record) => record.country_code.toUpperCase() === "GH").length;
}
