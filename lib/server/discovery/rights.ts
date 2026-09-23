export const reuseStatuses = ["official_open_data", "explicitly_licensed", "written_permission", "official_api", "public_link_only", "permission_unknown", "prohibited"] as const;
export type ReuseStatus = typeof reuseStatuses[number];

export type SourceRights = {
  reuse_status: ReuseStatus;
  license_name?: string | null;
  license_url?: string | null;
  permission_evidence?: string | null;
  permission_date?: string | null;
  permission_expiry?: string | null;
  content_reuse_allowed: boolean;
  commercial_reuse_allowed: boolean;
  document_reuse_allowed: boolean;
  metadata_reuse_allowed: boolean;
  discovery_enabled?: boolean;
  discovery_auto_publish_enabled?: boolean;
  crawl_robots_allowed?: boolean;
  crawl_terms_reviewed?: boolean;
};

export function rightsActive(source: SourceRights, now = new Date()) {
  if (source.reuse_status === "permission_unknown" || source.reuse_status === "prohibited") return false;
  if (source.permission_expiry && source.permission_expiry < now.toISOString().slice(0, 10)) return false;
  if (source.reuse_status === "explicitly_licensed") return Boolean(source.license_name && source.license_url);
  if (source.reuse_status === "official_open_data") return Boolean(source.license_url && source.permission_evidence);
  if (source.reuse_status === "written_permission") return Boolean(source.permission_evidence && source.permission_date);
  if (source.reuse_status === "official_api") return Boolean(source.permission_evidence || source.license_url);
  return source.reuse_status === "public_link_only";
}

export function canCrawl(source: SourceRights, now = new Date()) {
  return Boolean(source.discovery_enabled && source.crawl_robots_allowed && source.crawl_terms_reviewed &&
    rightsActive(source, now) && source.reuse_status !== "official_api" && source.reuse_status !== "official_open_data" && source.metadata_reuse_allowed &&
    (source.reuse_status === "public_link_only" || source.commercial_reuse_allowed));
}

export function canPublish(source: SourceRights, now = new Date()) {
  return rightsActive(source, now) && source.metadata_reuse_allowed &&
    (source.reuse_status === "public_link_only" || source.commercial_reuse_allowed);
}

export function canAutoPublish(source: SourceRights, now = new Date()) {
  return source.reuse_status !== "public_link_only" && source.reuse_status !== "official_open_data" && canCrawl(source, now) && canPublish(source, now) && Boolean(source.discovery_auto_publish_enabled);
}

export function validateRights(source: SourceRights) {
  if ((source.reuse_status === "permission_unknown" || source.reuse_status === "prohibited") &&
    (source.discovery_enabled || source.discovery_auto_publish_enabled || source.content_reuse_allowed ||
      source.commercial_reuse_allowed || source.document_reuse_allowed || source.metadata_reuse_allowed))
    return "Unknown or prohibited rights must remain disabled with no reuse permissions.";
  if (source.reuse_status === "public_link_only" &&
    (source.content_reuse_allowed || source.document_reuse_allowed || !source.metadata_reuse_allowed))
    return "Public-link-only sources may store factual metadata, not source content or documents.";
  if (source.reuse_status === "official_open_data" && (!source.license_url || !source.permission_evidence || source.document_reuse_allowed || source.discovery_enabled || source.discovery_auto_publish_enabled))
    return "Official open data requires recorded provenance and must use its structured-data importer, not web crawling or document mirroring.";
  if (source.discovery_enabled && !canCrawl(source)) return "Source rights, metadata scope, robots and terms must be approved before crawling.";
  if (source.discovery_auto_publish_enabled && !canAutoPublish(source)) return "Automatic publication is not permitted by this source's rights and crawl settings.";
  return null;
}
