import { ApiError } from "@/lib/server/api-error";
import {
  requireOrganizationMember,
  type AuthenticatedUser,
} from "@/lib/server/auth";
import { primaryOrganization } from "@/lib/server/entitlements";
import { encodeFilter, supabaseRest } from "@/lib/server/supabase-rest";

export type ProcurementRole =
  | "organization_owner"
  | "procurement_manager"
  | "procurement_officer"
  | "evaluator"
  | "technical_expert"
  | "finance_evaluator"
  | "approver"
  | "viewer"
  | "bid_team_member";
export type ProcurementTender = {
  id: string;
  organization_id: string;
  created_by: string;
  owner_user_id: string;
  title: string;
  reference_number: string | null;
  description: string;
  tender_type: string;
  procurement_category: string;
  classification: string;
  location: string | null;
  currency: string;
  estimated_budget: number | null;
  issue_date: string | null;
  clarification_deadline: string | null;
  submission_deadline: string;
  eligibility_requirements: string;
  technical_requirements: string;
  commercial_requirements: string;
  delivery_requirements: string;
  terms_and_conditions: string;
  award_structure: "single" | "multiple" | "lots";
  bid_opening_model: "sealed" | "open_as_received";
  visibility: "open" | "invite_only" | "open_preferred";
  supplier_verification_requirement: "any" | "verified" | "enhanced_verified";
  questions_allowed: boolean;
  supplier_identity_visible_before_opening: boolean;
  withdrawal_allowed: boolean;
  approval_required: boolean;
  status: string;
  published_at: string | null;
  bids_opened_at: string | null;
  created_at: string;
  updated_at: string;
};

const buyerManagers = new Set<ProcurementRole>([
  "organization_owner",
  "procurement_manager",
  "procurement_officer",
]);

export async function procurementContext(user: AuthenticatedUser) {
  const primary = await primaryOrganization(user.id);
  if (!primary)
    throw new ApiError(
      400,
      "Create an organisation profile before using procurement.",
      "organization_required",
    );
  const { data } = await supabaseRest<
    Array<{
      role: string;
      procurement_role: ProcurementRole;
      organization: {
        id: string;
        name: string;
        can_bid: boolean;
        can_procure: boolean;
      };
    }>
  >(
    `organization_members?select=role,procurement_role,organization:organizations(id,name,can_bid,can_procure)&organization_id=eq.${primary.organization_id}&user_id=eq.${user.id}&limit=1`,
  );
  const member = data[0];
  if (!member?.organization)
    throw new ApiError(
      403,
      "Organisation access was not found.",
      "organization_access_denied",
    );
  const role: ProcurementRole =
    member.role === "owner" ? "organization_owner" : member.procurement_role;
  return {
    organizationId: primary.organization_id,
    organization: member.organization,
    membershipRole: member.role,
    role,
    canManage: buyerManagers.has(role),
  };
}

export async function requireProcurementManager(
  user: AuthenticatedUser,
  organizationId?: string,
) {
  const context = await procurementContext(user);
  if (organizationId && context.organizationId !== organizationId)
    throw new ApiError(
      403,
      "You cannot manage another organisation's procurement.",
      "procurement_access_denied",
    );
  if (!context.organization.can_procure)
    throw new ApiError(
      403,
      "Activate procurement capabilities for this organisation first.",
      "procurement_capability_required",
    );
  if (!context.canManage)
    throw new ApiError(
      403,
      "Your procurement role cannot perform this action.",
      "procurement_role_denied",
    );
  return context;
}

export async function tenderById(id: string) {
  const { data } = await supabaseRest<ProcurementTender[]>(
    `procurement_tenders?select=*&id=eq.${encodeFilter(id)}&limit=1`,
  );
  if (!data[0])
    throw new ApiError(404, "Tender not found.", "tender_not_found");
  return data[0];
}

export async function requireTenderManager(
  user: AuthenticatedUser,
  id: string,
) {
  const tender = await tenderById(id);
  const context = await requireProcurementManager(user, tender.organization_id);
  return { tender, context };
}

export async function requireTenderEvaluator(
  user: AuthenticatedUser,
  id: string,
) {
  const tender = await tenderById(id);
  if (
    tender.organization_id ===
    (await primaryOrganization(user.id))?.organization_id
  ) {
    const member = await requireOrganizationMember(
      user.id,
      tender.organization_id,
    );
    if (member.role === "owner")
      return { tender, role: "organization_owner" as ProcurementRole };
  }
  const { data } = await supabaseRest<Array<{ assignment_role: string }>>(
    `procurement_evaluation_assignments?select=assignment_role&tender_id=eq.${id}&evaluator_user_id=eq.${user.id}&limit=1`,
  );
  if (!data[0])
    throw new ApiError(
      403,
      "You are not assigned to evaluate this tender.",
      "evaluation_access_denied",
    );
  return { tender, role: data[0].assignment_role };
}

export function bidsAreOpen(tender: ProcurementTender) {
  return (
    tender.bid_opening_model === "open_as_received" ||
    Boolean(tender.bids_opened_at) ||
    Date.now() >= Date.parse(tender.submission_deadline)
  );
}

export async function buyerVerification(organizationId: string) {
  const { data } = await supabaseRest<Array<{ status: string }>>(
    `buyer_verifications?select=status&organization_id=eq.${organizationId}&limit=1`,
  );
  return data[0]?.status || "unverified";
}

export async function audit(input: {
  organizationId: string;
  tenderId?: string | null;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}) {
  await supabaseRest("procurement_audit_logs", {
    method: "POST",
    body: JSON.stringify({
      organization_id: input.organizationId,
      tender_id: input.tenderId || null,
      actor_user_id: input.actorUserId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId || null,
      before_data: input.before || null,
      after_data: input.after || null,
      metadata: input.metadata || {},
    }),
  });
}
