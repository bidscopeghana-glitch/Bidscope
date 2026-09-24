export type AmendmentChange = { field: string; previous: unknown; current: unknown };

const timestampFields = new Set([
  "deadline_at",
  "opening_at",
  "clarification_deadline_at",
  "published_at",
]);

function normalizedValue(field: string, value: unknown) {
  if (value == null) return null;
  if (timestampFields.has(field) && typeof value === "string") {
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) return new Date(timestamp).toISOString();
  }
  return value;
}

export function meaningfulAmendmentChanges(changes: AmendmentChange[]) {
  return changes.filter((change) => {
    const previous = normalizedValue(change.field, change.previous);
    const current = normalizedValue(change.field, change.current);
    return JSON.stringify(previous) !== JSON.stringify(current);
  });
}

export function amendmentFingerprint(changes: AmendmentChange[]) {
  return meaningfulAmendmentChanges(changes)
    .map((change) => `${change.field}:${JSON.stringify(normalizedValue(change.field, change.current))}`)
    .sort()
    .join("|");
}
