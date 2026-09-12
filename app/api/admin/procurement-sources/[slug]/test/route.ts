import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireSuperAdmin } from "@/lib/server/auth";
import { getProcurementAdapter } from "@/lib/server/procurement/registry";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    await requireSuperAdmin(request);
    const { slug } = await context.params;
    const adapter = getProcurementAdapter(slug);
    if (!adapter) throw new ApiError(404, "No code adapter exists for this source.", "adapter_not_found");
    return Response.json({ data: await adapter.healthCheck() });
  } catch (error) { return apiErrorResponse(error); }
}

