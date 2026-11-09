import {z} from "zod";
import {requireLocalCommerceSetup,cjConnectionStatus} from "@/lib/server/commerce/cj-connection";
import {commerceTestKey,saveCommerceTestKey,createPaymentTestService} from "@/lib/server/commerce/paystack-test";
import {apiErrorResponse} from "@/lib/server/api-error";
export async function GET(request:Request){try{requireLocalCommerceSetup(request);return Response.json({paystackTestConfigured:Boolean(await commerceTestKey()),cjConfigured:(await cjConnectionStatus()).configured,liveCheckout:false},{headers:{"Cache-Control":"no-store"}});}catch(error){return apiErrorResponse(error);}}
let pending=false;
export async function POST(request:Request){let acquired=false;try{
 requireLocalCommerceSetup(request);if(Number(request.headers.get("content-length")||0)>4096)return Response.json({error:"Request too large."},{status:413});if(pending)return Response.json({error:"A test operation is already running."},{status:429});
 const input=z.discriminatedUnion("action",[z.object({action:z.literal("connect"),key:z.string().regex(/^sk_test_[A-Za-z0-9]{20,200}$/)}),z.object({action:z.literal("initialize")}),z.object({action:z.literal("verify"),reference:z.string().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/)})]).parse(await request.json());
 pending=true;acquired=true;if(input.action==="connect")return Response.json(await saveCommerceTestKey(input.key));
 const service=createPaymentTestService(await commerceTestKey());try{const callback=new URL("/shop/payment-test",request.url);callback.host=request.headers.get("host")!;return Response.json(input.action==="initialize"?await service.initialize(callback.href):await service.verify(input.reference));}finally{service.close();}
 }catch{return Response.json({error:"The payment test could not be completed. Check test-key setup and reconcile any existing reference. No live payment or supplier order was submitted."},{status:400});}finally{if(acquired)pending=false;}}
