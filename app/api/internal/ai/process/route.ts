import { apiErrorResponse } from "@/lib/server/api-error";
import { requireCronOrInternalSecret } from "@/lib/server/auth";
import { processNextAIJob } from "@/lib/server/ai/jobs";
export const runtime="nodejs";export const maxDuration=300;
export async function POST(request:Request){try{requireCronOrInternalSecret(request);return Response.json({data:await processNextAIJob()});}catch(error){return apiErrorResponse(error);}}
