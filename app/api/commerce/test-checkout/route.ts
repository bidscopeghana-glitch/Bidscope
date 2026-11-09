import {z} from "zod";
import {requireSuperAdmin} from "@/lib/server/auth";
import {ApiError,apiErrorResponse} from "@/lib/server/api-error";
import {supabaseRest,supabaseRpc} from "@/lib/server/supabase-rest";
import {requireShopLedger,type StoredShopOrder} from "@/lib/server/commerce/shop-order-store";
import {initializeShopTestPayment,validShopCheckoutUrl} from "@/lib/server/commerce/shop-test-checkout";
export const runtime="nodejs";
const inputSchema=z.object({quoteId:z.string().uuid(),requestKey:z.string().uuid()}).strict();
type CheckoutOrder=StoredShopOrder&{payment_init_status:string;checkout_url:string|null};
export async function POST(request:Request){try{
 const {user}=await requireSuperAdmin(request);requireShopLedger();
 const key=process.env.BIDSCOPE_COMMERCE_PAYSTACK_TEST_SECRET||"";if(!key.startsWith("sk_test_"))throw new ApiError(503,"Sandbox checkout is not configured.");
 const origin=new URL(process.env.NEXT_PUBLIC_SITE_URL||"").origin;
 if(request.headers.get("origin")!==origin||new URL(request.url).origin!==origin)throw new ApiError(403,"Use the configured shopping preview.");
 const input=inputSchema.parse(await request.json());
 const {data:quotes}=await supabaseRest<{mode:string}[]>("bidscope_shop_quotes?"+new URLSearchParams({select:"mode",id:"eq."+input.quoteId,customer_id:"eq."+user.id,limit:"1"}));
 if(quotes[0]?.mode!=="test")throw new ApiError(404,"Sandbox quote not found.");
 const {data:id}=await supabaseRpc<string>("bidscope_shop_create_order",{p_customer:user.id,p_quote:input.quoteId,p_key:input.requestKey});
 const load=async()=>{const {data}=await supabaseRest<CheckoutOrder[]>("bidscope_shop_orders?"+new URLSearchParams({select:"id,customer_id,payment_reference,payment_mode,status,currency,total_minor,quote_expires_at,created_at,payment_init_status,checkout_url",id:"eq."+id,customer_id:"eq."+user.id,limit:"1"}));return data[0];};
 const claimed=(await supabaseRpc<boolean>("bidscope_shop_begin_payment",{p_order:id,p_customer:user.id})).data;
 const order=await load();if(!order)throw new ApiError(404,"Order not found.");
 if(!claimed){if(order.payment_init_status==="ready"&&order.status==="awaiting_payment"&&order.checkout_url&&Date.parse(order.quote_expires_at)>Date.now())return Response.json({orderId:id,url:validShopCheckoutUrl(order.checkout_url),duplicate:true});throw new ApiError(409,"This order already has a payment attempt. Check order status before retrying.","payment_reconciliation_required");}
 const query="bidscope_shop_orders?"+new URLSearchParams({id:"eq."+id,payment_init_status:"eq.initializing"});
 try{
  const url=await initializeShopTestPayment({reference:order.payment_reference,amountMinor:order.total_minor,currency:"GHS",mode:"test"},user.email,origin+"/shop/orders?"+new URLSearchParams({payment:order.payment_reference}),key);
  await supabaseRest(query,{method:"PATCH",body:JSON.stringify({payment_init_status:"ready",checkout_url:url})});
  return Response.json({orderId:id,url,mode:"test",checkoutEnabled:false},{headers:{"Cache-Control":"private, no-store"}});
 }catch{
  await supabaseRest(query,{method:"PATCH",body:JSON.stringify({payment_init_status:"review"})});
  await supabaseRest("bidscope_shop_jobs?on_conflict=order_id,kind",{method:"POST",headers:{Prefer:"resolution=ignore-duplicates"},body:JSON.stringify({order_id:id,kind:"payment_review",status:"exception",last_error:"Payment initialization needs provider reconciliation; do not initialize again."})});
  throw new ApiError(503,"The payment attempt needs reconciliation. No automatic retry will be made.","payment_reconciliation_required");
 }
 }catch(error){return apiErrorResponse(error);}}
