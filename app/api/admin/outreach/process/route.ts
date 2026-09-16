import {apiErrorResponse} from "@/lib/server/api-error";
import {requireSuperAdmin} from "@/lib/server/auth";
import {processNextOutreachImport} from "@/lib/server/outreach/jobs";
import {processOutreachSendQueue} from "@/lib/server/outreach/sending";
import {processNextAIJob} from "@/lib/server/ai/jobs";
export const runtime="nodejs";export const maxDuration=300;
export async function POST(request:Request){try{await requireSuperAdmin(request);const[imports,sending,ai]=await Promise.all([processNextOutreachImport(),processOutreachSendQueue(),processNextAIJob()]);return Response.json({data:{imports,sending,ai}});}catch(error){return apiErrorResponse(error);}}
