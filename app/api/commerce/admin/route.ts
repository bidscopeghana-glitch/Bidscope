import {requireSuperAdmin} from "@/lib/server/auth";
import {apiErrorResponse} from "@/lib/server/api-error";
import {cjConnectionStatus} from "@/lib/server/commerce/cj-connection";
export async function GET(request:Request){try{await requireSuperAdmin(request);const cj=await cjConnectionStatus();return Response.json({mode:"preview",liveCheckout:false,providers:[{id:"cj",approval:cj.publicationApproval,credentials:cj.configured?"configured":"missing",authenticated:cj.authenticated,tokenExpiresAt:cj.expiresAt},{id:"alibaba",approval:"unverified",credentials:"not_configured"}],database:"migration_not_applied",supplierBalance:null});}catch(error){return apiErrorResponse(error);}}
