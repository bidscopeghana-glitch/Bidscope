import {z} from "zod";
import {requireLocalCommerceSetup} from "@/lib/server/commerce/cj-connection";
import {openCatalogue} from "@/lib/server/commerce/catalogue-store";
import {getDailyFx,ghsMinor} from "@/lib/server/commerce/daily-fx";
import {retailUsdMinor} from "@/lib/commerce/retail-pricing";
import {apiErrorResponse} from "@/lib/server/api-error";
export async function POST(request:Request){try{
 requireLocalCommerceSetup(request);if(Number(request.headers.get("content-length")||0)>25000)return Response.json({error:"Request too large."},{status:413});
 const input=z.object({productIds:z.array(z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/)).max(100)}).parse(await request.json());
 const fx=await getDailyFx(),store=openCatalogue();try{const prices:Record<string,number>={};for(const id of new Set(input.productIds)){const p=store.find(id);if(p?.minUsdMinor!==null&&p?.minUsdMinor!==undefined)prices[id]=ghsMinor(retailUsdMinor(p.minUsdMinor),fx);}return Response.json({prices,asOf:fx.asOf,indicative:true,checkoutEnabled:false},{headers:{"Cache-Control":"no-store"}});}finally{store.close();}
 }catch(error){return apiErrorResponse(error);}}
