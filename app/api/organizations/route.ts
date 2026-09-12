import { apiErrorResponse } from "@/lib/server/api-error";
import { requireUser } from "@/lib/server/auth";
import { organizationSchema } from "@/lib/server/schemas";
import { supabaseRest, supabaseRpc } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const membershipQuery = new URLSearchParams({
      select: "role,organization:organizations(*)",
      user_id: `eq.${user.id}`,
      order: "created_at.asc",
    });
    const { data } = await supabaseRest<unknown[]>(`organization_members?${membershipQuery}`);
    return Response.json({ data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { accessToken } = await requireUser(request);
    const input = organizationSchema.parse(await request.json());
    const { data } = await supabaseRpc<unknown>("create_organization_with_owner", {
      organization_name: input.name,
      organization_slug: input.slug,
      organization_sectors: input.sectors,
      organization_region: input.region || null,
    }, accessToken);
    return Response.json({ data }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

