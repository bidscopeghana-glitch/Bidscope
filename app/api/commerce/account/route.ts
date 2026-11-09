import {requireUser} from "@/lib/server/auth";
import {apiErrorResponse} from "@/lib/server/api-error";
import {customerCommerceOrders} from "@/lib/server/commerce/storage";
export async function GET(request:Request){try{const {user,accessToken}=await requireUser(request);const {data}=await customerCommerceOrders(user.id,accessToken);return Response.json({data});}catch(error){return apiErrorResponse(error);}}
