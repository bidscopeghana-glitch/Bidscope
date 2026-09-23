import { apiErrorResponse } from "@/lib/server/api-error";
import { requireCronOrInternalSecret } from "@/lib/server/auth";
import { runGhanepsOcds } from "@/lib/server/discovery/ocds-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  try {
    requireCronOrInternalSecret(request);
    const started = Date.now();
    const batches = [];
    for (let i = 0; i < 20 && Date.now() - started < 240_000; i++) {
      const result = await runGhanepsOcds("full", undefined, true);
      batches.push(result);
      if (("skipped" in result && result.skipped) || ("nextCursor" in result && (result.nextCursor === null || result.errors > 0))) break;
    }
    const last = batches.at(-1);
    return Response.json({ data: { batches, complete: Boolean(last && (("skipped" in last && last.skipped) || ("nextCursor" in last && last.nextCursor === null))) } });
  }
  catch (error) { return apiErrorResponse(error); }
}
