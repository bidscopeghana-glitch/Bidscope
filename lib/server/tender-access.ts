import { requireUser, type AuthenticatedUser } from "./auth";
import { getEntitlement, primaryOrganization } from "./entitlements";

export type TenderAccess = {
  authenticated: boolean;
  allowed: boolean;
  user?: AuthenticatedUser;
  reason: "anonymous" | "free_plan" | "no_workspace" | "active_subscription" | "admin_override";
};

export async function tenderAccessForUser(user: AuthenticatedUser): Promise<TenderAccess> {
  const membership = await primaryOrganization(user.id);
  if (!membership) return { authenticated: true, allowed: false, user, reason: "no_workspace" };
  const entitlement = await getEntitlement(membership.organization_id, user);
  if (entitlement.adminOverride) return { authenticated: true, allowed: true, user, reason: "admin_override" };
  const allowed = entitlement.tier === "PREMIUM" && entitlement.features.tender_source_access !== false;
  return { authenticated: true, allowed, user, reason: allowed ? "active_subscription" : "free_plan" };
}

/** Single server-side gate for source, document, buyer and application access. */
export async function canViewTenderSource(request: Request): Promise<TenderAccess> {
  if (!request.headers.get("authorization")) return { authenticated: false, allowed: false, reason: "anonymous" };
  const { user } = await requireUser(request);
  return tenderAccessForUser(user);
}
