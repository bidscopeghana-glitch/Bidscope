import {supabaseRest} from "../supabase-rest";
import {ApiError} from "../api-error";
export function commerceStorageReady(){return process.env.BIDSCOPE_COMMERCE_STORAGE_READY==="1";}
export async function customerCommerceOrders(userId:string,accessToken:string){
 if(!commerceStorageReady())throw new ApiError(503,"Commerce order storage is not configured.","commerce_storage_unavailable");
 const query=new URLSearchParams({select:"id,merchant_reference,status,currency,total_minor,shipping_minor,fee_minor,duty_minor,created_at,order_lines(quantity,unit_price_minor)",customer_id:"eq."+userId,order:"created_at.desc",limit:"50"});
 return supabaseRest<unknown[]>("orders?"+query,{accessToken,serviceRole:false,headers:{"Accept-Profile":"commerce"}});
}
