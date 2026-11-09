import {requireSuperAdmin} from "@/lib/server/auth";
import {apiErrorResponse} from "@/lib/server/api-error";
import {requireShopLedger} from "@/lib/server/commerce/shop-order-store";
import {supabaseRest} from "@/lib/server/supabase-rest";
export async function GET(request:Request){try{
 await requireSuperAdmin(request);requireShopLedger();
 const [orders,jobs,requests]=await Promise.all([
  supabaseRest<unknown[]>("bidscope_shop_orders?"+new URLSearchParams({select:"id,payment_reference,payment_mode,status,currency,total_minor,shipping_minor,customer_fee_minor,fulfilment_snapshot,payment_init_status,created_at",order:"created_at.desc",limit:"50"})),
  supabaseRest<unknown[]>("bidscope_shop_jobs?"+new URLSearchParams({select:"id,order_id,kind,status,attempts,last_error,created_at",status:"neq.done",order:"created_at.desc",limit:"100"})),
  supabaseRest<unknown[]>("bidscope_shop_requests?"+new URLSearchParams({select:"id,order_id,kind,message,status,created_at",status:"in.(open,reviewing)",order:"created_at.desc",limit:"100"}))
 ]);
 return Response.json({orders:orders.data,jobs:jobs.data,requests:requests.data,liveCheckoutEnabled:false,supplierAutoPaymentEnabled:false},{headers:{"Cache-Control":"private, no-store","Vary":"Authorization"}});
 }catch(error){return apiErrorResponse(error);}}
