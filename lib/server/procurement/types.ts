export const SOURCE_IMPLEMENTATION_STATUSES = [
  "LIVE",
  "AUTHORIZATION_REQUIRED",
  "API_KEY_REQUIRED",
  "CONFIGURATION_REQUIRED",
  "RESEARCH_REQUIRED",
  "UNAVAILABLE",
  "READY_API_REQUIRED",
  "READY_MANUAL_CONFIGURATION_REQUIRED",
  "UNSUPPORTED",
  "NEEDS_REVIEW",
] as const;

export type SourceImplementationStatus = (typeof SOURCE_IMPLEMENTATION_STATUSES)[number];

export type ProcurementSource = {
  id: string;
  name: string;
  slug: string;
  organisation: string;
  base_url: string;
  country_code: string;
  integration_type: "API" | "OPEN_API" | "OPEN_DATA" | "RSS" | "STRUCTURED_WEB" | "MANUAL" | "DISABLED";
  implementation_status: SourceImplementationStatus;
  api_enabled: boolean;
  api_key_required: boolean;
  environment_key_name: string | null;
  endpoint_url: string | null;
  sync_enabled: boolean;
  sync_frequency: string;
  status: "ACTIVE" | "DEGRADED" | "PAUSED" | "ERROR" | "UNAVAILABLE";
  trust_level: "VERIFIED_OFFICIAL" | "OFFICIAL" | "PUBLIC" | "NEEDS_REVIEW";
  configuration: Record<string, unknown>;
  consecutive_failures?: number;
};

export type NormalizedOpportunity = {
  bidscope_reference: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  buyer_name: string;
  buyer_type: string | null;
  country: string;
  country_code: string;
  region: string | null;
  sector: string | null;
  category: "goods" | "works" | "services" | "consulting" | "other";
  subcategory: string | null;
  procurement_method: string | null;
  contract_type: string | null;
  currency: string | null;
  estimated_value: number | null;
  minimum_value: number | null;
  maximum_value: number | null;
  published_at: string | null;
  deadline_at: string | null;
  status: "UPCOMING" | "OPEN" | "CLOSING_SOON" | "CLOSED" | "AWARDED" | "CANCELLED" | "DRAFT" | "ARCHIVED" | "UNKNOWN";
  notice_stage?: "FORECAST" | "PLANNED" | "OPEN" | "AWARD" | "OTHER";
  eligibility_status?: "GHANA_ELIGIBLE" | "INTERNATIONAL_ELIGIBLE" | "RESTRICTED" | "UNCLEAR";
  eligibility_summary?: string | null;
  source_name: string;
  source_type: string;
  external_opportunity_id: string | null;
  external_reference: string | null;
  source_resource_id: string | null;
  official_source_url: string;
  official_tender_url: string | null;
  official_submission_url: string | null;
  submission_platform: string | null;
  submission_method: string | null;
  requires_registration: boolean;
  registration_url: string | null;
  funding_source: string;
  funding_agency: string | null;
  eligibility_text: string | null;
  eligibility_country: string | null;
  documents_url: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  last_source_update: string | null;
  last_verified_at: string;
  data_confidence: "VERIFIED_OFFICIAL_SOURCE" | "OFFICIAL_SOURCE" | "PUBLIC_SOURCE" | "NEEDS_REVIEW" | "STALE";
  verification_status: "VERIFIED" | "OFFICIAL" | "NEEDS_REVIEW" | "STALE";
  raw_source_hash: string;
  document_fingerprint: string;
  raw_payload: Record<string, unknown>;
};

export type AdapterHealth = { ok: boolean; message: string; checkedAt: string };

export type NormalizedProject = {
  external_project_id: string; name: string; country: string | null; country_code: string | null;
  region: string | null; sector: string | null; status: string | null; financing_institution: string;
  official_url: string; raw_payload: Record<string, unknown>; last_verified_at: string;
};

export type NormalizedAward = {
  external_award_id: string; project_external_id: string | null; opportunity_external_id: string | null;
  buyer_name: string | null; title: string; reference_number: string | null; award_date: string | null;
  currency: string | null; value: number | null; procurement_method: string | null; source_url: string;
  supplier_name: string | null; supplier_country: string | null; raw_payload: Record<string, unknown>;
};

export interface ProcurementSourceAdapter<Raw = unknown> {
  readonly slug: string;
  fetchOpportunities(): Promise<Raw[]>;
  fetchOpportunityById(id: string): Promise<Raw | null>;
  normaliseOpportunity(raw: Raw): Promise<NormalizedOpportunity>;
  getOfficialUrl(raw: Raw): string;
  getSubmissionUrl(raw: Raw): string | null;
  healthCheck(): Promise<AdapterHealth>;
  fetchProjects?(records: Raw[]): Promise<NormalizedProject[]>;
  fetchAwards?(): Promise<NormalizedAward[]>;
}
