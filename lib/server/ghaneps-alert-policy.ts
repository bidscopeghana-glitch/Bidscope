export function isGhanepsSource(sourceName: string | null | undefined): boolean {
  return /\bghaneps\b/i.test(sourceName || "");
}

export function alertableSearchResults<T extends { source_name?: string | null }>(results: T[]): T[] {
  return results.filter((result) => !isGhanepsSource(result.source_name));
}
