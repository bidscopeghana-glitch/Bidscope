import {z} from "zod";
import {requireLocalCommerceSetup,cjConnection} from "@/lib/server/commerce/cj-connection";
import {createCjCatalogueInspector} from "@/lib/server/commerce/cj-catalogue";
import {openCatalogue} from "@/lib/server/commerce/catalogue-store";
import {productPresentation} from "@/lib/commerce/product-presentation";
import {ApiError,apiErrorResponse} from "@/lib/server/api-error";
import {getDailyFx,ghsMinor} from "@/lib/server/commerce/daily-fx";
import {retailUsdMinor} from "@/lib/commerce/retail-pricing";
import {createProductReader} from "@/lib/server/commerce/product-reader";
const api=createCjCatalogueInspector(()=>cjConnection.token());
const readProduct=createProductReader(async id=>{
 const store=openCatalogue();let item;try{item=store.find(id);}finally{store.close();}
 if(!item)throw new ApiError(404,"This product is not in the imported catalogue.","product_not_found");
 const {draft,raw}=await api.details(id),presentation=productPresentation(item,draft,raw);
 try{const fx=await getDailyFx();presentation.ghsPrices=Object.fromEntries(draft.variants.map(v=>[v.id,ghsMinor(retailUsdMinor(v.costUsdMinor),fx)]));presentation.fxAsOf=fx.asOf;}catch{/* Do not invent a conversion if the feed is unavailable. */}
 return presentation;
});
export async function GET(request:Request){
 try{
  requireLocalCommerceSetup(request);
  const id=z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/).parse(new URL(request.url).searchParams.get("id"));
  return Response.json(await readProduct(id),{headers:{"Cache-Control":"no-store"}});
 }catch(error){return apiErrorResponse(error);}
}
