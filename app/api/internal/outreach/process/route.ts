import {apiErrorResponse} from "@/lib/server/api-error";
import {requireCronOrInternalSecret} from "@/lib/server/auth";
import {processNextOutreachImport} from "@/lib/server/outreach/jobs";
import {processOutreachSendQueue} from "@/lib/server/outreach/sending";
export const runtime="nodejs";export const maxDuration=300;
export async function GET(request:Request){try{requireCronOrInternalSecret(request);const[imports,sending]=await Promise.all([processNextOutreachImport(),processOutreachSendQueue()]);return Response.json({data:{imports,sending}});}catch(error){return apiErrorResponse(error);}}
export const POST=GET;
