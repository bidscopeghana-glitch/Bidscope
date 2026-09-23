import { z } from "zod";
import { apiErrorResponse } from "@/lib/server/api-error";
import { requireSuperAdmin } from "@/lib/server/auth";
import { ghanepsOcdsStatus, runGhanepsOcds, setGhanepsOcdsPaused } from "@/lib/server/discovery/ocds-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["check", "dry_run", "limited", "full"]) }),
  z.object({ action: z.literal("pause"), paused: z.boolean() }),
]);

export async function GET(request: Request) {
  try { await requireSuperAdmin(request); return Response.json({ data: await ghanepsOcdsStatus() }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireSuperAdmin(request);
    const input = inputSchema.parse(await request.json());
    const result = input.action === "pause" ? await setGhanepsOcdsPaused(input.paused, user.id) : await runGhanepsOcds(input.action, user.id);
    return Response.json({ data: result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
