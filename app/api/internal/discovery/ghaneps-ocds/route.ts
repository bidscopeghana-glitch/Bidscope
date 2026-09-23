import { apiErrorResponse } from "@/lib/server/api-error";
import { requireCronOrInternalSecret } from "@/lib/server/auth";
import { runGhanepsOcds } from "@/lib/server/discovery/ocds-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  try { requireCronOrInternalSecret(request); return Response.json({ data: await runGhanepsOcds("full", undefined, true) }); }
  catch (error) { return apiErrorResponse(error); }
}
