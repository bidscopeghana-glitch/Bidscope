import {requireUser} from "@/lib/server/auth";
import {apiErrorResponse} from "@/lib/server/api-error";
import {ownShopOrders} from "@/lib/server/commerce/shop-order-store";
export async function GET(request:Request){try{
 const {user}=await requireUser(request);
 return Response.json({orders:await ownShopOrders(user.id)},{headers:{"Cache-Control":"private, no-store","Vary":"Authorization"}});
 }catch(error){return apiErrorResponse(error);}}
