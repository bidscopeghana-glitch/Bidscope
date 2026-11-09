import {ApiError,apiErrorResponse} from "@/lib/server/api-error";
import {verifyShopPayment,verifyShopWebhook,ShopPaymentMismatch} from "@/lib/server/commerce/shop-payments";
import {orderForPayment,recordShopPayment} from "@/lib/server/commerce/shop-order-store";
export const runtime="nodejs";
export async function POST(request:Request){try{
 // This initial rollout accepts test transactions only. Live charges remain blocked.
 const key=process.env.BIDSCOPE_COMMERCE_PAYSTACK_TEST_SECRET||"";
 if(!key.startsWith("sk_test_"))throw new ApiError(503,"Commerce test payments are not configured.","shop_payment_unconfigured");
 if(Number(request.headers.get("content-length")||0)>100000)throw new ApiError(413,"Event too large.");
 const raw=new Uint8Array(await request.arrayBuffer());if(raw.byteLength>100000)throw new ApiError(413,"Event too large.");
 const signingSecrets=(process.env.BIDSCOPE_COMMERCE_PAYSTACK_WEBHOOK_SECRETS||"").split(",").map(value=>value.trim()).filter(Boolean);
 if(!verifyShopWebhook(raw,request.headers,{apiKey:key,signingSecrets}))throw new ApiError(401,"Invalid webhook signature.","invalid_signature");
 let event:{event?:string;data?:{reference?:string}};try{event=JSON.parse(new TextDecoder().decode(raw));}catch{throw new ApiError(400,"Invalid event.");}
 if(event.event!=="charge.success"||typeof event.data?.reference!=="string"||!/^BSC-SBX-[A-Za-z0-9-]{1,80}$/.test(event.data.reference))return Response.json({received:true,ignored:true});
 const order=await orderForPayment(event.data.reference);
 if(!order)return Response.json({received:true,ignored:true});
 if(order.payment_mode!=="test")throw new ApiError(409,"Order payment environment mismatch.");
 let status:string;
 try{const payment=await verifyShopPayment({reference:order.payment_reference,amountMinor:order.total_minor,currency:order.currency,mode:"test"},key);status=await recordShopPayment(order,payment);}
 catch(error){if(!(error instanceof ShopPaymentMismatch))throw error;status=await recordShopPayment(order,error.payment);}
 // No supplier API work is performed in this request. The durable job is queued atomically.
 return Response.json({received:true,status});
 }catch(error){return apiErrorResponse(error);}}
