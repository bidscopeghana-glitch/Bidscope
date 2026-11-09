import {randomUUID} from "node:crypto";
import {setTimeout as pause} from "node:timers/promises";
import {z} from "zod";
import {requireSuperAdmin} from "@/lib/server/auth";
import {ApiError,apiErrorResponse} from "@/lib/server/api-error";
import {supabaseRest,supabaseRpc} from "@/lib/server/supabase-rest";
import {requireShopLedger} from "@/lib/server/commerce/shop-order-store";
import {CjSandboxProvider} from "@/lib/server/commerce/providers";
import {cjConnection} from "@/lib/server/commerce/cj-connection";
import {createCjCatalogueInspector} from "@/lib/server/commerce/cj-catalogue";
import {supplierPayload,sandboxSupplierInput,checkedSandboxOrder,nextSandboxStatus} from "@/lib/server/commerce/sandbox-fulfilment";
export const runtime="nodejs";
export const maxDuration=120;
const inputSchema=z.object({orderId:z.string().uuid(),supplierId:z.string().uuid().optional(),action:z.enum(["create","sync","pay","advance"])}).strict();
type Supplier={id:string;order_id:string;merchant_reference:string;provider_order_id:string|null;state:string;payload:unknown};
type Order={id:string;payment_mode:string;status:string;total_minor:number;received_amount_minor:number|null;received_mode:string|null;received_currency:string|null;verified_at:string|null;delivery_address:unknown};
export async function POST(request:Request){try{
 await requireSuperAdmin(request);requireShopLedger();
 if(request.headers.get("origin")!==new URL(request.url).origin||request.headers.get("content-type")?.split(";")[0]!=="application/json")throw new ApiError(403,"Same-origin JSON is required.");
 const input=inputSchema.parse(await request.json());
 const {data:orders}=await supabaseRest<Order[]>("bidscope_shop_orders?"+new URLSearchParams({select:"id,payment_mode,status,total_minor,received_amount_minor,received_mode,received_currency,verified_at,delivery_address",id:"eq."+input.orderId,limit:"1"}));
 const order=orders[0];if(!order||order.payment_mode!=="test"||order.received_mode!=="test"||order.received_currency!=="GHS"||order.received_amount_minor!==order.total_minor||!order.verified_at)throw new ApiError(409,"An exactly verified sandbox payment is required.");
 if(input.action!=="sync"&&!["paid","supplier_payment_pending","exception","partially_shipped","shipped","delivered"].includes(order.status))throw new ApiError(409,"Resolve the cancellation, return or refund before changing fulfilment.");
 if(input.action==="create")await supabaseRpc("bidscope_shop_prepare_supplier",{p_order:order.id});
 const {data:rows}=await supabaseRest<Supplier[]>("bidscope_shop_supplier_orders?"+new URLSearchParams({select:"id,order_id,merchant_reference,provider_order_id,state,payload",order_id:"eq."+order.id,order:"line_index.asc",...(input.supplierId?{id:"eq."+input.supplierId}:{})}));
 if(input.action==="create"&&rows.some(row=>["exception","submitting"].includes(row.state)))throw new ApiError(409,"Reconcile the existing supplier write before creating another.");
 const supplier=input.action==="create"?rows.find(row=>row.state==="awaiting_creation"):rows[0];
 if(!supplier)return Response.json({message:"No supplier action is required.",sandbox:true});
 const payload=supplierPayload.parse(supplier.payload),lease=randomUUID();
 if(!(await supabaseRpc<boolean>("bidscope_cj_review_acquire",{p_lease:lease})).data)throw new ApiError(429,"Another CJ operation is running. Try again shortly.");
 const path="bidscope_shop_supplier_orders?"+new URLSearchParams({id:"eq."+supplier.id});
 try{
  const token=await cjConnection.token();
  const transport:typeof fetch=async(url,init)=>{await pause(1100);return fetch(url,init);};
  const provider=new CjSandboxProvider(token.accessToken,token.accessTokenExpiryDate,{approved:true,evidence:"Owner-authorised private sandbox integration test only; no catalogue/media publication approval.",expiresAt:token.accessTokenExpiryDate,productIds:[payload.productId],mediaAllowed:false},transport);
  let providerId=supplier.provider_order_id;
  if(input.action==="create"){
   if(!(await supabaseRpc<boolean>("bidscope_shop_claim_supplier",{p_supplier:supplier.id})).data)throw new ApiError(409,"This supplier write was already claimed.");
   const inspector=createCjCatalogueInspector(async()=>{await pause(1100);return token;},fetch,1100,8000);
   const checked=await inspector.checkoutLine(payload.productId,payload.variantId,payload.origin,payload.quantity,payload.destination);
   const route=checked.shipping.routes.find(route=>route.name===payload.service);
   const postage=route?.totalPostageUsdMinor??(route&&route.taxUsdMinor!==null&&route.clearanceUsdMinor!==null?route.shippingUsdMinor+route.taxUsdMinor+route.clearanceUsdMinor:null);
   if(checked.costUsdMinor>payload.supplierUnitUsdMinor||postage===null||postage>payload.postageUsdMinor)throw Error("Supplier price or freight increased; manual review required.");
   await supabaseRest(path,{method:"PATCH",body:JSON.stringify({write_attempted:true})});
   const created=z.object({orderId:z.string().min(1).max(200)}).parse(await provider.createSandboxOrder(sandboxSupplierInput(supplier.merchant_reference,payload,order.delivery_address)));
   providerId=created.orderId;
   await supabaseRest(path,{method:"PATCH",body:JSON.stringify({provider_order_id:providerId})});
  }
  let remote=checkedSandboxOrder(await provider.order(providerId||supplier.merchant_reference),supplier.merchant_reference,providerId||undefined);
  if(providerId&&providerId!==remote.orderId)await supabaseRpc("bidscope_shop_canonicalize_supplier",{p_supplier:supplier.id,p_alias:providerId,p_canonical:remote.orderId});
  providerId=remote.orderId;
  if(input.action==="pay"){
   if(["CREATED","IN_CART"].includes(remote.orderStatus)){await provider.confirmSandboxOrder(providerId);remote=checkedSandboxOrder(await provider.order(providerId),supplier.merchant_reference,providerId);}
   if(remote.orderStatus==="UNPAID")await provider.sandboxAction(providerId,"pay");
   remote=checkedSandboxOrder(await provider.order(providerId),supplier.merchant_reference,providerId);
   if(!remote.trackNumber&&["PENDING","PROCESSING","UNSHIPPED","SHIPPED","DELIVERED"].includes(remote.orderStatus))await provider.sandboxAction(providerId,"tracking","BIDSCOPE-TEST-"+supplier.id.replaceAll("-",""));
   remote=checkedSandboxOrder(await provider.order(providerId),supplier.merchant_reference,providerId);
  }
  if(input.action==="advance"){
   const next=nextSandboxStatus(remote.orderStatus);if(next!==null)await provider.sandboxAction(providerId,"status",next);
   remote=checkedSandboxOrder(await provider.order(providerId),supplier.merchant_reference,providerId);
  }
  const {data:status}=await supabaseRpc<string>("bidscope_shop_sync_supplier",{p_supplier:supplier.id,p_provider:remote.orderId,p_status:remote.orderStatus,p_tracking:remote.trackNumber||null,p_carrier:remote.trackingProvider||payload.service});
  return Response.json({sandbox:true,status,providerStatus:remote.orderStatus,message:"Sandbox supplier state synchronised. No real payment or shipment."},{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){
  const message="Sandbox supplier operation needs review. Reconcile the existing reference before any new write.";
  await supabaseRest(path,{method:"PATCH",body:JSON.stringify({...(input.action==="create"?{state:"exception"}:{}),last_error:message})});
  if(input.action==="create"){
   await supabaseRest("bidscope_shop_orders?"+new URLSearchParams({id:"eq."+order.id,status:"in.(paid,supplier_payment_pending,exception)"}),{method:"PATCH",body:JSON.stringify({status:"exception"})});
   await supabaseRest("bidscope_shop_jobs?"+new URLSearchParams({order_id:"eq."+order.id,kind:"eq.fulfilment"}),{method:"PATCH",body:JSON.stringify({status:"exception",lease_until:null,last_error:message})});
  }
  throw error instanceof ApiError?error:new ApiError(422,message,"sandbox_supplier_review_required");
 }finally{await supabaseRpc("bidscope_cj_review_release",{p_lease:lease});}
 }catch(error){return apiErrorResponse(error);}}
