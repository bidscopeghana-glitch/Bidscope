import {ApiError,apiErrorResponse} from "@/lib/server/api-error";
import {requireUser} from "@/lib/server/auth";

export const dynamic="force-dynamic";

export async function GET(request:Request){try{await requireUser(request);throw new ApiError(403,"CSV export is not available for BidScope users.","csv_export_disabled");}catch(error){return apiErrorResponse(error);}}
