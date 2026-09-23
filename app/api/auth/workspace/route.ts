import { apiErrorResponse } from "@/lib/server/api-error";
import { requireUser } from "@/lib/server/auth";
import { supabaseConfiguration, supabaseRest } from "@/lib/server/supabase-rest";
import { customerReturnPath } from "@/lib/auth-return";

export const dynamic = "force-dynamic";

type UsageMode = "buyer" | "supplier";
type Membership = {
  organization: { id: string; can_bid: boolean; can_procure: boolean } | null;
};

export async function GET(request: Request) {
  try {
    const { user, accessToken } = await requireUser(request);
    const url = new URL(request.url);
    const requestedMode = url.searchParams.get("intendedMode");
    const intendedMode: UsageMode | null = requestedMode === "buyer" || requestedMode === "supplier" ? requestedMode : null;

    if (intendedMode && user.metadata?.bidscope_usage !== intendedMode) {
      const config = supabaseConfiguration();
      await fetch(`${config.url}/auth/v1/user`, {
        method: "PUT",
        headers: { apikey: config.publicKey || config.serviceKey || "", Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ data: { bidscope_usage: intendedMode } }),
        cache: "no-store",
      });
    }

    const { data } = await supabaseRest<Membership[]>(
      `organization_members?select=organization:organizations(id,can_bid,can_procure)&user_id=eq.${user.id}&order=created_at.asc&limit=1`,
    );
    const organization = data[0]?.organization || null;
    const savedMode = intendedMode || (user.metadata?.bidscope_usage === "buyer" ? "buyer" : user.metadata?.bidscope_usage === "supplier" ? "supplier" : null);
    const workspace: UsageMode = organization
      ? organization.can_procure && !organization.can_bid
        ? "buyer"
        : organization.can_bid && !organization.can_procure
          ? "supplier"
          : savedMode || "supplier"
      : savedMode || "supplier";
    const requestedPath = customerReturnPath(url.searchParams.get("next"));
    const destination = requestedPath.startsWith("/admin/command-centre") || requestedPath === "/services/requests"
      ? requestedPath
      : workspace === "buyer"
        ? organization
          ? requestedPath.startsWith("/procurement") ? requestedPath : "/procurement"
          : "/procurement/onboarding"
        : organization
          ? requestedPath.startsWith("/customer") ? requestedPath : "/customer"
          : "/customer/profile?onboarding=seller";

    return Response.json({ data: { workspace, destination, hasOrganization: Boolean(organization) } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
