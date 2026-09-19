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
    const { data } = await supabaseRpc<{ id: string } | Array<{ id: string }>>("create_organization_with_owner", {
      organization_name: input.name,
      organization_slug: input.slug,
      organization_sectors: input.sectors,
      organization_region: input.region || null,
    }, accessToken);
    const created = Array.isArray(data) ? data[0] : data;
    if (!created?.id) throw new Error("The organisation was created without an identifier.");

    const buyer = input.accountType === "buyer";
    const [{ data: organizations }] = await Promise.all([
      supabaseRest<Array<Record<string, unknown>>>(`organizations?id=eq.${created.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          can_bid: !buyer,
          can_procure: buyer,
          organization_type: input.organizationType || (buyer ? "procuring_organisation" : "supplier"),
          registration_number: input.registrationNumber,
          company_email: input.companyEmail,
          procurement_contact: input.contactPerson,
          services: input.services,
          products: input.products,
          expected_procurement_categories: input.expectedProcurementCategories,
        }),
      }),
      supabaseRest(`organization_members?organization_id=eq.${created.id}`, {
        method: "PATCH",
        body: JSON.stringify({ procurement_role: buyer ? "organization_owner" : "bid_team_member" }),
      }),
    ]);
    return Response.json({ data: organizations[0] || created }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
