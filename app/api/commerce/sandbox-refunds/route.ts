import {z} from "zod";
import {requireSuperAdmin} from "@/lib/server/auth";
import {ApiError,apiErrorResponse} from "@/lib/server/api-error";
import {supabaseRest,supabaseRpc} from "@/lib/server/supabase-rest";
import {requireShopLedger} from "@/lib/server/commerce/shop-order-store";
import {createTestRefund,readTestRefund} from "@/lib/server/commerce/shop-refunds";
const inputSchema=z.discriminatedUnion("action",[
 z.object({action:z.literal("create"),orderId:z.string().uuid(),requestKey:z.string().uuid(),amountMinor:z.number().int().min(1).max(100000000),reason:z.string().trim().min(1).max(1000)}).strict(),
 z.object({action:z.literal("sync"),refundId:z.string().uuid()}).strict()
]);
type Refund={id:string;order_id:string;reference:string;amount_minor:number;status:string;provider_refund_id:string|null};
export async function POST(request:Request){try{
 await requireSuperAdmin(request);requireShopLedger();
 if(request.headers.get("origin")!==new URL(request.url).origin||request.headers.get("content-type")?.split(";")[0]!=="application/json")throw new ApiError(403,"Same-origin JSON is required.");
 const key=process.env.BIDSCOPE_COMMERCE_PAYSTACK_TEST_SECRET||"";if(!key.startsWith("sk_test_"))throw new ApiError(503,"Paystack TEST key required.");
 const input=inputSchema.parse(await request.json());
 const id=input.action==="create"?(await supabaseRpc<string>("bidscope_shop_reserve_refund",{p_order:input.orderId,p_key:input.requestKey,p_amount:input.amountMinor,p_reason:input.reason})).data:input.refundId;
 const {data:refunds}=await supabaseRest<Refund[]>("bidscope_shop_refunds?"+new URLSearchParams({select:"id,order_id,reference,amount_minor,status,provider_refund_id",id:"eq."+id,limit:"1"}));
 const refund=refunds[0];if(!refund)throw new ApiError(404,"Sandbox refund not found.");
 const {data:orders}=await supabaseRest<{payment_reference:string;provider_transaction:string;payment_mode:string}[]>("bidscope_shop_orders?"+new URLSearchParams({select:"payment_reference,provider_transaction,payment_mode",id:"eq."+refund.order_id,limit:"1"}));
 const order=orders[0];if(!order||order.payment_mode!=="test")throw new ApiError(409,"Only sandbox refunds are supported.");
 const expected={reference:refund.reference,paymentReference:order.payment_reference,transactionId:order.provider_transaction,amountMinor:refund.amount_minor};
 let claimed=false;
 if(input.action==="create")claimed=(await supabaseRpc<boolean>("bidscope_shop_claim_refund",{p_refund:refund.id})).data;
 try{
  const remote=claimed?await createTestRefund(expected,key):await readTestRefund(expected,refund.provider_refund_id,key);
  const {data:status}=await supabaseRpc<string>("bidscope_shop_sync_refund",{p_refund:refund.id,p_provider:remote.providerId,p_status:remote.status});
  return Response.json({id:refund.id,status,sandbox:true,message:"TEST refund state verified. No real funds moved."},{headers:{"Cache-Control":"private, no-store"}});
 }catch{
  if(claimed)await supabaseRest("bidscope_shop_refunds?"+new URLSearchParams({id:"eq."+refund.id,status:"eq.submitting"}),{method:"PATCH",body:JSON.stringify({status:"exception",last_error:"Refund write is uncertain. Reconcile its saved reference; do not create another."})});
  throw new ApiError(422,"Refund needs provider reconciliation. It has not been marked refunded.","sandbox_refund_review_required");
 }
 }catch(error){return apiErrorResponse(error);}}
