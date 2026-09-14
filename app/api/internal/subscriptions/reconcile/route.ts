import {apiErrorResponse} from "@/lib/server/api-error";
import {requireCronOrInternalSecret} from "@/lib/server/auth";
import {expireEndedSubscriptions,reconcilePendingPaystack} from "@/lib/server/paystack";
export const dynamic="force-dynamic";export const maxDuration=60;
export async function POST(request:Request){try{requireCronOrInternalSecret(request);const[reconciliation,expiry]=await Promise.all([reconcilePendingPaystack(25),expireEndedSubscriptions()]);return Response.json({data:{reconciliation,expiry}});}catch(error){return apiErrorResponse(error);}}
export async function GET(request:Request){return POST(request);}
