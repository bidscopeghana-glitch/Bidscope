import {requireSuperAdmin} from "@/lib/server/auth";
import {apiErrorResponse} from "@/lib/server/api-error";
export async function GET(request:Request){try{await requireSuperAdmin(request);return Response.json({mode:"preview",liveCheckout:false,providers:[{id:"cj",approval:"unverified",credentials:"not_checked"},{id:"alibaba",approval:"unverified",credentials:"not_checked"}],database:"migration_not_applied",supplierBalance:null});}catch(error){return apiErrorResponse(error);}}
