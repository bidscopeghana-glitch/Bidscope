import {z} from "zod";
import {requireUser} from "@/lib/server/auth";
import {ApiError,apiErrorResponse} from "@/lib/server/api-error";
import {orderForPayment,recordShopPayment} from "@/lib/server/commerce/shop-order-store";
import {verifyShopPayment,ShopPaymentMismatch} from "@/lib/server/commerce/shop-payments";
export async function POST(request:Request){try{
 const {user}=await requireUser(request);
 const {reference}=z.object({reference:z.string().regex(/^BSC-SBX-[A-Za-z0-9-]{1,80}$/)}).strict().parse(await request.json());
 const order=await orderForPayment(reference);if(!order||order.customer_id!==user.id)throw new ApiError(404,"Order not found.");
 const key=process.env.BIDSCOPE_COMMERCE_PAYSTACK_TEST_SECRET||"";
 if(!key.startsWith("sk_test_")||order.payment_mode!=="test")throw new ApiError(503,"Sandbox payment verification unavailable.");
 let status:string;
 try{const payment=await verifyShopPayment({reference,amountMinor:order.total_minor,currency:"GHS",mode:"test"},key);status=await recordShopPayment(order,payment);}
 catch(error){if(!(error instanceof ShopPaymentMismatch))throw error;status=await recordShopPayment(order,error.payment);}
 return Response.json({status},{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){return apiErrorResponse(error);}}
