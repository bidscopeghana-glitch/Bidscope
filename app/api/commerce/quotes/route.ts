import {randomUUID} from "node:crypto";
import {setTimeout as pause} from "node:timers/promises";
import {requireSuperAdmin} from "@/lib/server/auth";
import {ApiError,apiErrorResponse} from "@/lib/server/api-error";
import {supabaseRest,supabaseRpc} from "@/lib/server/supabase-rest";
import {requireShopLedger} from "@/lib/server/commerce/shop-order-store";
import {buildSandboxShopQuote} from "@/lib/server/commerce/shop-quotes";
import {shopQuoteInput,checkoutCostPolicy} from "@/lib/commerce/shop-checkout";
import {createCjCatalogueInspector} from "@/lib/server/commerce/cj-catalogue";
import {cjConnection} from "@/lib/server/commerce/cj-connection";
import {getDailyFx} from "@/lib/server/commerce/daily-fx";
import {hostedCatalogueQuery} from "@/lib/server/commerce/hosted-catalogue";
export const runtime="nodejs";
export const maxDuration=180;
export async function POST(request:Request){try{
 const {user}=await requireSuperAdmin(request);requireShopLedger();
 if(process.env.BIDSCOPE_CJ_HOSTED_REVIEW!=="1"||!process.env.CJ_API_KEY)throw new ApiError(503,"CJ review is unavailable.");
 if(request.headers.get("origin")!==new URL(request.url).origin||request.headers.get("content-type")?.split(";")[0]!=="application/json")throw new ApiError(403,"Same-origin JSON is required.");
 const input=shopQuoteInput.parse(await request.json()),lease=randomUUID();
 if(!(await supabaseRpc<boolean>("bidscope_cj_review_acquire",{p_lease:lease})).data)throw new ApiError(429,"Another supplier check is running. Try again shortly.");
 try{
  const inspector=createCjCatalogueInspector(async()=>{const token=await cjConnection.token();await pause(1100);return token;},fetch,1100,8000);
  const quote=await buildSandboxShopQuote(input,{fx:getDailyFx,async exists(id){return (await supabaseRest<unknown[]>(hostedCatalogueQuery({id}).path)).data.length===1;},check:(line,selection)=>inspector.checkoutLine(line.productId,line.variantId,selection.origin,line.quantity,selection.address.countryCode)});
  const {input:privateInput,...saved}=quote;void privateInput;
  const {data}=await supabaseRest<{id:string}[]>("bidscope_shop_quotes?select=id",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({...saved,customer_id:user.id})});
  return Response.json({id:data[0].id,mode:"test",currency:"GHS",items:quote.items,deliveries:quote.fulfilment_snapshot.lines.map(line=>({origin:line.origin,destination:line.destination,service:line.service,estimate:line.estimate})),merchandiseMinor:quote.merchandise_minor,shippingMinor:quote.shipping_minor,customerFeeMinor:0,totalMinor:quote.total_minor,expiresAt:quote.expires_at,fxAsOf:quote.fulfilment_snapshot.fxAsOf,disclosure:checkoutCostPolicy.copy,checkoutEnabled:false},{headers:{"Cache-Control":"private, no-store"}});
 }finally{await supabaseRpc("bidscope_cj_review_release",{p_lease:lease});}
 }catch(error){return apiErrorResponse(error);}}
