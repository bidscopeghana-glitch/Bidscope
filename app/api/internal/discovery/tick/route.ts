import { timingSafeEqual } from "node:crypto";
import { apiErrorResponse, ApiError } from "@/lib/server/api-error";
import { discoveryTick } from "@/lib/server/discovery/service";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const expected = process.env.DISCOVERY_WORKER_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || !supplied) return false;
  const left = Buffer.from(expected), right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  try {
    if (!authorized(request)) throw new ApiError(401, "Unauthorized discovery scheduler.", "unauthorized");
    const result = await discoveryTick();
    return Response.json({ data: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
