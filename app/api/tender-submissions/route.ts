import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { apiErrorResponse } from "@/lib/server/api-error";
import { supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const submissionSchema = z.object({
  organizationId: z.string().uuid().nullable().optional(), title: z.string().trim().min(10).max(300), buyerName: z.string().trim().min(2).max(200),
  country: z.string().trim().min(2).max(100).default("Ghana"), region: z.string().trim().max(120).nullable().optional(), city: z.string().trim().max(120).nullable().optional(),
  category: z.string().trim().max(160).nullable().optional(), industry: z.string().trim().max(160).nullable().optional(), description: z.string().trim().min(30).max(12000),
  contractType: z.string().trim().max(120).nullable().optional(), estimatedValue: z.number().nonnegative().nullable().optional(), valueMin: z.number().nonnegative().nullable().optional(), valueMax: z.number().nonnegative().nullable().optional(), currency: z.string().trim().max(8).default("GHS"),
  publicationDate: z.string().date().nullable().optional(), clarificationDeadline: z.string().date().nullable().optional(), submissionDeadline: z.string().date().nullable().optional(), awardDate: z.string().date().nullable().optional(), startDate: z.string().date().nullable().optional(), endDate: z.string().date().nullable().optional(), duration: z.string().trim().max(120).nullable().optional(),
  eligibility: z.string().trim().max(5000).nullable().optional(), certifications: z.string().trim().max(5000).nullable().optional(), financialRequirements: z.string().trim().max(5000).nullable().optional(), experienceRequirements: z.string().trim().max(5000).nullable().optional(), technicalRequirements: z.string().trim().max(5000).nullable().optional(),
  referenceNumber: z.string().trim().max(160).nullable().optional(), procurementMethod: z.string().trim().max(120).nullable().optional(), contactName: z.string().trim().max(160).nullable().optional(), contactEmail: z.string().email().nullable().optional(), contactPhone: z.string().trim().max(80).nullable().optional(), buyerWebsite: z.string().url().nullable().optional(), tenderUrl: z.string().url().nullable().optional(), submissionUrl: z.string().url().nullable().optional(), submissionInstructions: z.string().trim().max(5000).nullable().optional(), additionalInformation: z.string().trim().max(8000).nullable().optional(), tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]), submit: z.boolean().default(true),
});

async function duplicateWarning(input: z.infer<typeof submissionSchema>) {
  const warnings: Array<{ type: string; id?: string; title?: string }> = [];
  if (input.referenceNumber) {
    const { data } = await supabaseRest<Array<{ id: string; title: string }>>(`procurement_opportunities?select=id,title&reference_number=eq.${encodeURIComponent(input.referenceNumber)}&limit=3`, { serviceRole: true });
    warnings.push(...data.map((item) => ({ type: "reference", ...item })));
  }
  const { data: similar } = await supabaseRest<Array<{ id: string; title: string }>>(`procurement_opportunities?select=id,title&title=ilike.*${encodeURIComponent(input.title.slice(0, 80))}*&buyer_name=ilike.*${encodeURIComponent(input.buyerName.slice(0, 60))}*&limit=3`, { serviceRole: true });
  warnings.push(...similar.map((item) => ({ type: "title_buyer", ...item })));
  return warnings.length ? warnings : null;
}

export async function GET(request: Request) {
  try { const { user } = await requireUser(request); const { data } = await supabaseRest(`tender_submissions?select=*&submitted_by=eq.${user.id}&order=created_at.desc&limit=100`, { serviceRole: true }); return Response.json({ data }, { headers }); } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireUser(request); const input = submissionSchema.parse(await request.json()); const warning = await duplicateWarning(input);
    const row = { submitted_by: user.id, organization_id: input.organizationId ?? null, title: input.title, buyer_name: input.buyerName, country: input.country, region: input.region ?? null, city: input.city ?? null, category: input.category ?? null, industry: input.industry ?? null, description: input.description, contract_type: input.contractType ?? null, estimated_value: input.estimatedValue ?? null, value_min: input.valueMin ?? null, value_max: input.valueMax ?? null, currency: input.currency, publication_date: input.publicationDate ?? null, clarification_deadline: input.clarificationDeadline ?? null, submission_deadline: input.submissionDeadline ?? null, award_date: input.awardDate ?? null, start_date: input.startDate ?? null, end_date: input.endDate ?? null, duration: input.duration ?? null, eligibility: input.eligibility ?? null, certifications: input.certifications ?? null, financial_requirements: input.financialRequirements ?? null, experience_requirements: input.experienceRequirements ?? null, technical_requirements: input.technicalRequirements ?? null, reference_number: input.referenceNumber ?? null, procurement_method: input.procurementMethod ?? null, contact_name: input.contactName ?? null, contact_email: input.contactEmail ?? null, contact_phone: input.contactPhone ?? null, buyer_website: input.buyerWebsite ?? null, tender_url: input.tenderUrl ?? null, submission_url: input.submissionUrl ?? null, submission_instructions: input.submissionInstructions ?? null, additional_information: input.additionalInformation ?? null, tags: input.tags, duplicate_warning: warning, status: input.submit ? "SUBMITTED" : "DRAFT", submitted_at: input.submit ? new Date().toISOString() : null, updated_at: new Date().toISOString() };
    const { data } = await supabaseRest<Array<Record<string, unknown>>>("tender_submissions", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row), serviceRole: true });
    return Response.json({ data: data[0], duplicateWarning: warning }, { status: 201, headers });
  } catch (error) { return apiErrorResponse(error); }
}
