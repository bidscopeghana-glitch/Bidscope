import {z} from "zod";
import {ghsMinor,type DailyFx} from "./daily-fx.ts";
import {retailUsdMinor} from "../../commerce/retail-pricing.ts";
export const priceRequest=z.object({productIds:z.array(z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/)).max(100)}).strict();
export function hostedPriceQuery(raw:unknown){
 const {productIds}=priceRequest.parse(raw);
 const ids=[...new Set(productIds)];
 const query=new URLSearchParams({select:"supplier_product_id,min_usd_minor",source_id:"eq.cj",publication_status:"in.(draft,held)",supplier_product_id:"in.("+ids.join(",")+")",limit:"100"});
 return {ids,path:"bidscope_catalogue_drafts?"+query};
}
export function cediPrices(rows:{supplier_product_id:string;min_usd_minor:number|null}[],fx:DailyFx){
 const prices:Record<string,number>={};
 for(const row of rows)if(row.min_usd_minor!==null)prices[row.supplier_product_id]=ghsMinor(retailUsdMinor(row.min_usd_minor),fx);
 return prices;
}
