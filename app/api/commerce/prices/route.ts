import {requireSuperAdmin} from "@/lib/server/auth";
import {ApiError,apiErrorResponse} from "@/lib/server/api-error";
import {supabaseRest} from "@/lib/server/supabase-rest";
import {getDailyFx} from "@/lib/server/commerce/daily-fx";
import {hostedPriceQuery,cediPrices} from "@/lib/server/commerce/hosted-prices";
export async function POST(request:Request){try{
 await requireSuperAdmin(request);
 if(Number(request.headers.get("content-length")||0)>25000)throw new ApiError(413,"Request too large.");
 const {ids,path}=hostedPriceQuery(await request.json());
 const fx=await getDailyFx();
 const {data}=ids.length?await supabaseRest<{supplier_product_id:string;min_usd_minor:number|null}[]>(path):{data:[]};
 return Response.json({prices:cediPrices(data,fx),asOf:fx.asOf,validUntil:fx.validUntil,currency:"GHS",indicative:true,checkoutEnabled:false},{headers:{"Cache-Control":"private, no-store","Vary":"Authorization"}});
 }catch(error){return apiErrorResponse(error);}}
