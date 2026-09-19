import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { requireSuperAdmin } from "@/lib/server/auth";
import { supabaseConfiguration, supabaseRest } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request);
    const params = new URL(request.url).searchParams;
    const id = params.get("verificationId") || "";
    const index = Number(params.get("index") || "0");
    if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(index) || index < 0)
      throw new ApiError(400, "A valid verification document is required.", "invalid_document");
    const { data } = await supabaseRest<Array<{ document_paths: string[] }>>(
      `buyer_verifications?select=document_paths&id=eq.${id}&limit=1`,
    );
    const path = data[0]?.document_paths?.[index];
    if (!path || !path.startsWith("verifications/"))
      throw new ApiError(404, "Verification document not found.", "document_not_found");
    const { url, serviceKey } = supabaseConfiguration();
    if (!serviceKey)
      throw new ApiError(503, "Private document storage is not configured.", "storage_unavailable");
    const response = await fetch(
      `${url}/storage/v1/object/procurement-private/${path}`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, cache: "no-store" },
    );
    if (!response.ok)
      throw new ApiError(404, "Verification document not found.", "document_not_found");
    const name = path.split("/").pop()?.replace(/^[0-9a-f-]{36}-/i, "") || "verification-document";
    return new Response(response.body, {
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
