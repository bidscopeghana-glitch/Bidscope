# Opportunity deduplication

Resolution order:

1. Same source plus stable external ID.
2. Normalised official reference number.
3. Document fingerprint.
4. Hash of canonical buyer, title, deadline date and estimated value.

Cross-source matches retain all records in `opportunity_sources`; they do not discard provenance. Same-source hash changes update the canonical record and create an immutable revision with field-level changes. Ambiguous records should remain separate rather than risk merging unrelated tenders.
