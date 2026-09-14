# Source compliance rules

Connectors may be `PERMITTED_API`, `PERMITTED_WEB_INGESTION`, `AUTHORIZATION_REQUIRED`, `API_KEY_REQUIRED`, `RESEARCH_REQUIRED`, or `UNAVAILABLE`. Web ingestion stores concise metadata and official links, respects published robots signals and rate limits, and never republishes complete protected tender documents. Absence of a robots file is recorded as unknown, not permission.

No connector may silently promote itself from research or credential-required status. The registry records the reuse basis, terms or documentation URL, robots status and coverage notes. If a publisher changes access conditions, pause the source, preserve the audit trail, and resolve the compliance question before resuming.
