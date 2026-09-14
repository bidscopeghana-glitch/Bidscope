import {apiErrorResponse} from "@/lib/server/api-error";
import {requireCronOrInternalSecret} from "@/lib/server/auth";
import {refreshAllOrganizationRetention} from "@/lib/server/procurement/retention";
export const dynamic="force-dynamic";export const maxDuration=60;
export async function GET(request:Request){try{requireCronOrInternalSecret(request);return Response.json(await refreshAllOrganizationRetention(25));}catch(error){return apiErrorResponse(error);}}
export async function POST(request:Request){return GET(request);}
