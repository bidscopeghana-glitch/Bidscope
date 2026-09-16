import {apiErrorResponse} from "@/lib/server/api-error";
import {unsubscribeWithToken} from "@/lib/server/outreach/unsubscribe";
export async function POST(_:Request,{params}:{params:Promise<{token:string}>}){try{const{token}=await params;await unsubscribeWithToken(token);return new Response(null,{status:204});}catch(error){return apiErrorResponse(error);}}
