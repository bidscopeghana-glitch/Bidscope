import {apiErrorResponse} from "@/lib/server/api-error";
import {processPaystackWebhook} from "@/lib/server/paystack";
export const dynamic="force-dynamic";export const maxDuration=30;
export async function POST(request:Request){try{const raw=await request.text();const data=await processPaystackWebhook(raw,request.headers.get("x-paystack-signature"));return Response.json({received:true,...data});}catch(error){return apiErrorResponse(error);}}
