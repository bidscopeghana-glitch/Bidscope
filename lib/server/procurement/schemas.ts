import { z } from "zod";

export const uuid = z.string().uuid();
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const nullableText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

export const lotSchema = z.object({
  lotNumber: text(1, 40),
  title: text(2, 200),
  description: z.string().trim().max(6000).default(""),
  quantity: z.number().positive().nullable().optional(),
  budget: z.number().nonnegative().nullable().optional(),
  requirements: z.string().trim().max(6000).default(""),
  evaluationCriteria: z
    .array(z.record(z.string(), z.unknown()))
    .max(30)
    .default([]),
});
export const requirementSchema = z.object({
  section: z.enum([
    "eligibility",
    "technical",
    "commercial",
    "delivery",
    "other",
  ]),
  title: text(2, 200),
  description: z.string().trim().max(6000).default(""),
  mandatory: z.boolean().default(true),
  displayOrder: z.number().int().min(0).max(500).default(0),
});
export const requiredDocumentSchema = z.object({
  name: text(2, 200),
  description: z.string().trim().max(2000).default(""),
  mandatory: z.boolean().default(true),
  acceptedMimeTypes: z.array(text(2, 120)).max(12).default([]),
  displayOrder: z.number().int().min(0).max(500).default(0),
});
export const criterionSchema = z
  .object({
    name: text(2, 200),
    description: z.string().trim().max(3000).default(""),
    criterionType: z.enum(["scored", "pass_fail", "text"]),
    weight: z.number().min(0).max(100).nullable().optional(),
    scoreMin: z.number().default(0),
    scoreMax: z.number().positive().default(10),
    guidance: z.string().trim().max(3000).default(""),
    mandatory: z.boolean().default(false),
    section: z
      .enum([
        "general",
        "technical",
        "commercial",
        "experience",
        "delivery",
        "compliance",
      ])
      .default("general"),
    displayOrder: z.number().int().min(0).max(500).default(0),
    lotNumber: z.string().trim().max(40).nullable().optional(),
  })
  .refine((v) => v.scoreMax > v.scoreMin, {
    message: "Maximum score must exceed minimum score",
    path: ["scoreMax"],
  });

export const tenderInputSchema = z
  .object({
    title: text(5, 300),
    referenceNumber: nullableText(120),
    description: text(20, 30000),
    tenderType: z.enum([
      "rfq",
      "rfp",
      "eoi",
      "itt",
      "prequalification",
      "other",
    ]),
    procurementCategory: text(2, 160),
    classification: z.enum([
      "goods",
      "services",
      "works",
      "consulting",
      "other",
    ]),
    location: nullableText(200),
    currency: z.string().trim().toUpperCase().length(3).default("GHS"),
    estimatedBudget: z.number().nonnegative().nullable().optional(),
    issueDate: z.string().datetime({ offset: true }).nullable().optional(),
    clarificationDeadline: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .optional(),
    submissionDeadline: z.string().datetime({ offset: true }),
    expectedAwardDate: z.string().date().nullable().optional(),
    expectedContractStartDate: z.string().date().nullable().optional(),
    eligibilityRequirements: z.string().trim().max(12000).default(""),
    technicalRequirements: z.string().trim().max(12000).default(""),
    commercialRequirements: z.string().trim().max(12000).default(""),
    deliveryRequirements: z.string().trim().max(12000).default(""),
    termsAndConditions: z.string().trim().max(20000).default(""),
    procurementOwnerName: nullableText(160),
    procurementOwnerEmail: z
      .string()
      .trim()
      .email()
      .max(320)
      .nullable()
      .optional(),
    awardStructure: z.enum(["single", "multiple", "lots"]),
    bidOpeningModel: z.enum(["sealed", "open_as_received"]),
    visibility: z.enum(["open", "invite_only", "open_preferred"]),
    supplierVerificationRequirement: z.enum(["any", "verified", "enhanced_verified"]).default("any"),
    questionsAllowed: z.boolean().default(true),
    supplierIdentityVisibleBeforeOpening: z.boolean().default(false),
    withdrawalAllowed: z.boolean().default(true),
    approvalRequired: z.boolean().default(false),
    publishAwardPublicly: z.boolean().default(false),
    lots: z.array(lotSchema).max(100).default([]),
    requirements: z.array(requirementSchema).max(200).default([]),
    requiredDocuments: z.array(requiredDocumentSchema).max(100).default([]),
    criteria: z.array(criterionSchema).max(100).default([]),
  })
  .superRefine((v, ctx) => {
    if (Date.parse(v.submissionDeadline) <= Date.now())
      ctx.addIssue({
        code: "custom",
        message: "Submission deadline must be in the future.",
        path: ["submissionDeadline"],
      });
    if (
      v.clarificationDeadline &&
      Date.parse(v.clarificationDeadline) > Date.parse(v.submissionDeadline)
    )
      ctx.addIssue({
        code: "custom",
        message: "Clarification deadline must be before submission deadline.",
        path: ["clarificationDeadline"],
      });
    if (v.awardStructure === "lots" && !v.lots.length)
      ctx.addIssue({
        code: "custom",
        message: "Add at least one lot.",
        path: ["lots"],
      });
    if (v.awardStructure !== "lots" && v.lots.length)
      ctx.addIssue({
        code: "custom",
        message: "Lots are only valid for a lot-based tender.",
        path: ["lots"],
      });
    const weighted = v.criteria.filter(
      (c) => c.criterionType === "scored" && c.weight != null,
    );
    if (
      weighted.length &&
      Math.abs(weighted.reduce((sum, c) => sum + (c.weight || 0), 0) - 100) >
        0.001
    )
      ctx.addIssue({
        code: "custom",
        message: "Weighted evaluation criteria must total 100%.",
        path: ["criteria"],
      });
  });

export const bidInputSchema = z.object({
  tenderId: uuid,
  bidPrice: z.number().nonnegative().nullable().optional(),
  currency: z.string().trim().toUpperCase().length(3).default("GHS"),
  priceBreakdown: z
    .array(z.object({ label: text(1, 160), amount: z.number().nonnegative() }))
    .max(100)
    .default([]),
  deliveryPeriod: nullableText(200),
  bidValidityDays: z.number().int().min(1).max(730).nullable().optional(),
  technicalResponse: z.string().trim().max(30000).default(""),
  methodologyResponse: z.string().trim().max(30000).default(""),
  experienceResponse: z.string().trim().max(30000).default(""),
  complianceDeclarations: z.record(z.string(), z.boolean()).default({}),
  notes: z.string().trim().max(10000).default(""),
  lotResponses: z
    .array(
      z.object({
        lotId: uuid,
        price: z.number().nonnegative().nullable().optional(),
        currency: z.string().trim().toUpperCase().length(3).default("GHS"),
        response: z.string().trim().max(12000).default(""),
      }),
    )
    .max(100)
    .default([]),
  responses: z
    .array(
      z.object({
        requirementId: uuid.nullable().optional(),
        criterionId: uuid.nullable().optional(),
        responseText: z.string().trim().max(12000).default(""),
        declaration: z.boolean().nullable().optional(),
      }),
    )
    .max(300)
    .default([]),
  submit: z.boolean().default(false),
});

export const verificationSchema = z.object({
  organizationName: text(2, 200),
  registrationNumber: text(2, 160),
  officialCompanyEmail: z.string().trim().toLowerCase().email().max(320),
  contactPerson: text(2, 160),
  organizationType: nullableText(120),
  documentPaths: z.array(text(2, 500)).max(20).default([]),
});
