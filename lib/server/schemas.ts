import { z } from "zod";

const uuid = z.string().uuid();
const shortText = (max: number) => z.string().trim().min(1).max(max);
const sourceConfigurationSchema = z.record(z.string(), z.unknown()).superRefine((value, context) => {
  const forbidden = /(api.?key|client.?secret|password|access.?token|credential)/i;
  const inspect = (candidate: unknown, path: string[] = []) => {
    if (!candidate || typeof candidate !== "object") return;
    for (const [key, nested] of Object.entries(candidate as Record<string, unknown>)) {
      if (forbidden.test(key)) context.addIssue({ code: z.ZodIssueCode.custom, message: "Secrets must be stored in server environment variables, not source configuration.", path: [...path, key] });
      inspect(nested, [...path, key]);
    }
  };
  inspect(value);
});

export const organizationSchema = z.object({
  name: shortText(160),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  sectors: z.array(shortText(80)).max(20).default([]),
  region: z.string().trim().max(120).nullable().optional(),
});

export const savedOpportunitySchema = z.object({
  organizationId: uuid,
  opportunityId: uuid,
  notes: z.string().trim().max(3000).default(""),
  pipelineStage: z.enum(["watching", "reviewing", "preparing", "submitted", "won", "lost"]).default("watching"),
});

export const alertRuleBaseSchema = z.object({
  organizationId: uuid,
  name: shortText(120),
  enabled: z.boolean().default(true),
  frequency: z.enum(["instant", "daily", "weekly"]).default("daily"),
  keywords: z.array(shortText(80)).max(30).default([]),
  excludedKeywords: z.array(shortText(80)).max(30).default([]),
  categories: z.array(z.enum(["goods", "works", "services", "consulting", "other"])).max(5).default([]),
  sectors: z.array(shortText(80)).max(20).default([]),
  regions: z.array(shortText(120)).max(20).default([]),
  buyerIds: z.array(uuid).max(50).default([]),
  minimumValue: z.number().nonnegative().nullable().optional(),
  maximumValue: z.number().nonnegative().nullable().optional(),
  deadlineDaysMin: z.number().int().nonnegative().max(365).nullable().optional(),
  deadlineDaysMax: z.number().int().nonnegative().max(730).nullable().optional(),
  emailRecipients: z.array(z.string().email().max(180)).min(1).max(10),
});

export const alertRuleSchema = alertRuleBaseSchema.refine((value) => !value.minimumValue || !value.maximumValue || value.minimumValue <= value.maximumValue, {
  message: "Minimum value cannot exceed maximum value.", path: ["minimumValue"],
});

export const alertRuleUpdateSchema = alertRuleBaseSchema.partial().omit({ organizationId: true });

export const opportunityIngestSchema = z.object({
  sourceKey: shortText(240),
  countryCode: z.string().length(2).toUpperCase().default("GH"),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(220),
  referenceNumber: z.string().trim().max(160).nullable().optional(),
  title: shortText(500),
  summary: z.string().trim().max(3000).default(""),
  description: z.string().trim().max(50000).default(""),
  category: z.enum(["goods", "works", "services", "consulting", "other"]),
  sectors: z.array(shortText(80)).max(30).default([]),
  procurementMethod: z.string().trim().max(180).nullable().optional(),
  buyerId: uuid.nullable().optional(),
  region: z.string().trim().max(120).nullable().optional(),
  currency: z.string().trim().toUpperCase().length(3).nullable().optional(),
  estimatedValue: z.number().nonnegative().nullable().optional(),
  publicationDate: z.string().date().nullable().optional(),
  deadline: z.string().datetime({ offset: true }).nullable().optional(),
  status: z.enum(["draft", "open", "closed", "cancelled", "awarded", "archived"]).default("open"),
  sourceUrl: z.string().url().max(2000),
  sourceDocumentUrl: z.string().url().max(2000).nullable().optional(),
  eligibility: z.string().trim().max(10000).nullable().optional(),
  contact: z.record(z.string(), z.unknown()).default({}),
  rawPayload: z.record(z.string(), z.unknown()).default({}),
  contentHash: z.string().trim().max(128).nullable().optional(),
  publishedAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export const opportunityIngestBatchSchema = z.object({
  sourceId: uuid,
  records: z.array(opportunityIngestSchema).min(1).max(250),
});

export const buyerIngestSchema = z.object({
  countryCode: z.string().length(2).toUpperCase().default("GH"),
  name: shortText(300),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(220),
  entityType: z.string().trim().max(120).nullable().optional(),
  region: z.string().trim().max(120).nullable().optional(),
  website: z.string().url().max(2000).nullable().optional(),
  sourceUrl: z.string().url().max(2000).nullable().optional(),
  description: z.string().trim().max(10000).nullable().optional(),
  contact: z.record(z.string(), z.unknown()).default({}),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const buyerIngestBatchSchema = z.object({ records: z.array(buyerIngestSchema).min(1).max(250) });

export const awardIngestSchema = z.object({
  sourceKey: shortText(240),
  sourceId: uuid,
  countryCode: z.string().length(2).toUpperCase().default("GH"),
  opportunityId: uuid.nullable().optional(),
  buyerId: uuid.nullable().optional(),
  title: shortText(500),
  referenceNumber: z.string().trim().max(160).nullable().optional(),
  awardDate: z.string().date().nullable().optional(),
  currency: z.string().trim().toUpperCase().length(3).nullable().optional(),
  awardValue: z.number().nonnegative().nullable().optional(),
  procurementMethod: z.string().trim().max(180).nullable().optional(),
  sourceUrl: z.string().url().max(2000),
  rawPayload: z.record(z.string(), z.unknown()).default({}),
  publishedAt: z.string().datetime({ offset: true }).nullable().optional(),
  suppliers: z.array(z.object({
    name: shortText(300),
    registrationNumber: z.string().trim().max(160).nullable().optional(),
    countryCode: z.string().length(2).toUpperCase().nullable().optional(),
    awardedValue: z.number().nonnegative().nullable().optional(),
    isJointVenture: z.boolean().default(false),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })).max(50).default([]),
});

export const awardIngestBatchSchema = z.object({ records: z.array(awardIngestSchema).min(1).max(250) });

export const sourceSchema = z.object({
  name: shortText(160),
  sourceType: z.enum(["api", "rss", "web", "manual", "file"]),
  countryCode: z.string().length(2).toUpperCase().default("GH"),
  baseUrl: z.string().url().max(2000).nullable().optional(),
  enabled: z.boolean().default(true),
  schedule: z.string().trim().max(120).nullable().optional(),
  configuration: sourceConfigurationSchema.default({}),
});

export const canonicalOpportunitySchema = z.object({
  sourceSlug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
  externalOpportunityId: z.string().trim().max(240).nullable().optional(),
  externalReference: z.string().trim().max(200).nullable().optional(),
  sourceResourceId: z.string().trim().max(240).nullable().optional(),
  title: shortText(500),
  summary: z.string().trim().max(3000).default(""),
  description: z.string().trim().max(50000).default(""),
  buyerName: z.string().trim().max(300).default(""),
  buyerType: z.string().trim().max(120).nullable().optional(),
  country: z.string().trim().max(120).default("Ghana"),
  countryCode: z.string().length(2).toUpperCase().default("GH"),
  region: z.string().trim().max(120).nullable().optional(),
  sector: z.string().trim().max(160).nullable().optional(),
  category: z.enum(["goods", "works", "services", "consulting", "other"]).default("other"),
  subcategory: z.string().trim().max(160).nullable().optional(),
  procurementMethod: z.string().trim().max(180).nullable().optional(),
  contractType: z.string().trim().max(180).nullable().optional(),
  currency: z.string().trim().toUpperCase().length(3).nullable().optional(),
  estimatedValue: z.number().nonnegative().nullable().optional(),
  minimumValue: z.number().nonnegative().nullable().optional(),
  maximumValue: z.number().nonnegative().nullable().optional(),
  publishedAt: z.string().datetime({ offset: true }).nullable().optional(),
  deadlineAt: z.string().datetime({ offset: true }).nullable().optional(),
  status: z.enum(["DRAFT", "OPEN", "CLOSED", "CANCELLED", "AWARDED", "ARCHIVED"]).default("OPEN"),
  officialSourceUrl: z.string().url().max(2000),
  officialTenderUrl: z.string().url().max(2000).nullable().optional(),
  officialSubmissionUrl: z.string().url().max(2000).nullable().optional(),
  submissionPlatform: z.string().trim().max(160).nullable().optional(),
  submissionMethod: z.string().trim().max(300).nullable().optional(),
  requiresRegistration: z.boolean().default(false),
  registrationUrl: z.string().url().max(2000).nullable().optional(),
  fundingSource: z.string().trim().max(160).default("Other"),
  fundingAgency: z.string().trim().max(200).nullable().optional(),
  eligibilityText: z.string().trim().max(10000).nullable().optional(),
  eligibilityCountry: z.string().trim().max(120).nullable().optional(),
  documentsUrl: z.string().url().max(2000).nullable().optional(),
  contactName: z.string().trim().max(300).nullable().optional(),
  contactEmail: z.string().email().max(320).nullable().optional(),
  contactPhone: z.string().trim().max(80).nullable().optional(),
  rawPayload: z.record(z.string(), z.unknown()).default({}),
}).refine((value) => value.minimumValue == null || value.maximumValue == null || value.minimumValue <= value.maximumValue, {
  message: "Minimum value cannot exceed maximum value.", path: ["minimumValue"],
});

export const canonicalOpportunityBatchSchema = z.object({ records: z.array(canonicalOpportunitySchema).min(1).max(250) });

export const bidTrackingSchema = z.object({
  opportunityId: uuid,
  organizationId: uuid.nullable().optional(),
  status: z.enum(["SAVED", "REVIEWING", "PREPARING", "READY_TO_SUBMIT", "OFFICIAL_SUBMISSION_OPENED", "SUBMITTED", "AWARDED", "UNSUCCESSFUL", "WITHDRAWN"]),
  submissionReference: z.string().trim().max(300).nullable().optional(),
  outcome: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(5000).default(""),
});

export const procurementSourceAdminSchema = z.object({
  name: shortText(160), organisation: shortText(200),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
  baseUrl: z.string().url().max(2000), countryCode: z.string().length(2).toUpperCase().default("GH"),
  integrationType: z.enum(["API", "OPEN_API", "OPEN_DATA", "RSS", "STRUCTURED_WEB", "MANUAL", "DISABLED"]),
  implementationStatus: z.enum(["LIVE", "AUTHORIZATION_REQUIRED", "API_KEY_REQUIRED", "CONFIGURATION_REQUIRED", "RESEARCH_REQUIRED", "UNAVAILABLE", "READY_API_REQUIRED", "READY_MANUAL_CONFIGURATION_REQUIRED", "UNSUPPORTED", "NEEDS_REVIEW"]),
  endpointUrl: z.string().url().max(2000).nullable().optional(),
  environmentKeyName: z.string().regex(/^[A-Z][A-Z0-9_]*$/).max(120).nullable().optional(),
  apiKeyRequired: z.boolean().default(false), syncEnabled: z.boolean().default(false),
  syncFrequency: z.string().trim().max(80).default("daily"),
  status: z.enum(["ACTIVE", "DEGRADED", "PAUSED", "ERROR", "UNAVAILABLE"]).default("PAUSED"),
  trustLevel: z.enum(["VERIFIED_OFFICIAL", "OFFICIAL", "PUBLIC", "NEEDS_REVIEW"]).default("NEEDS_REVIEW"),
  configuration: z.record(z.string(), z.unknown()).default({}),
});

export const alertTypeSchema = z.enum(["opportunity_match", "tender_amendment", "deadline", "buyer_activity", "award", "supplier_activity", "document_expiry", "workspace_reminder", "system"]);

export const alertPreferenceUpdateSchema = z.object({
  alertType: alertTypeSchema,
  inAppEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  frequency: z.enum(["instant", "daily", "weekly"]),
  urgentOverride: z.boolean().default(false),
  reminderDays: z.array(z.number().int().min(1).max(365)).max(8).default([]),
});

export const notificationUpdateSchema = z.object({
  read: z.boolean().optional(),
  dismissed: z.boolean().optional(),
}).refine((value) => value.read !== undefined || value.dismissed !== undefined, "No notification change supplied.");

export const watchedEntitySchema = z.object({
  organizationId: uuid.nullable().optional(),
  entityType: z.enum(["buyer", "supplier", "opportunity"]),
  entityId: uuid.nullable().optional(),
  entityName: z.string().trim().max(300).nullable().optional(),
  relevantOnly: z.boolean().default(true),
}).refine((value) => Boolean(value.entityId || value.entityName), "An entity ID or name is required.");

export const procurementAiSchema = z.object({
  opportunityId: uuid,
  organizationId: uuid.nullable().optional(),
  threadId: uuid.nullable().optional(),
  action: z.enum(["summary", "mandatory_documents", "disqualification_risks", "key_dates", "passport_comparison", "missing_items", "evaluation_criteria", "latest_amendment", "eligibility", "clarifications", "tender_report", "question"]).default("question"),
  question: z.string().trim().max(2000).default(""),
  allowSupplierPassport: z.boolean().default(false),
  analysisMode: z.enum(["standard", "deep"]).default("standard"),
});

export const documentIndexSchema = z.object({
  documentId: uuid,
  opportunityId: uuid,
  url: z.string().url().max(2000),
  mimeType: z.string().trim().max(120).nullable().optional(),
  extractedText: z.string().max(5_000_000).nullable().optional(),
});

export const supplierDocumentSchema = z.object({
  organizationId: uuid,
  documentType: shortText(120),
  title: shortText(240),
  sourceUrl: z.string().url().max(2000).nullable().optional(),
  issuedAt: z.string().date().nullable().optional(),
  expiresAt: z.string().date().nullable().optional(),
});
