import { z } from "zod";

const uuid = z.string().uuid();
const shortText = (max: number) => z.string().trim().min(1).max(max);

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
  configuration: z.record(z.string(), z.unknown()).default({}),
});
