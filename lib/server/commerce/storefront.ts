import {z} from "zod";
import {publicProductSchema,storefrontId} from "../../commerce/storefront.ts";
import {ghsMinor,type DailyFx} from "./daily-fx.ts";
import {retailUsdMinor} from "../../commerce/retail-pricing.ts";
import {cjPreviewImage} from "../../commerce/cj-preview.ts";
export const storeQuerySchema=z.object({q:z.string().trim().max(100).default(""),category:z.string().max(1000).default(""),page:z.coerce.number().int().min(1).max(5000).default(1),sort:z.enum(["featured","low","high"]).default("featured"),id:storefrontId.optional()}).strict();
export function storefrontQuery(raw:unknown,now=Date.now()){
 const input=storeQuerySchema.parse(raw),query=new URLSearchParams({select:"product_id,title,description,category,image_url,origin,snapshot,checked_at",status:"eq.approved",review_expires_at:"gt."+new Date(now).toISOString(),order:input.sort==="low"?"min_usd_minor.asc,product_id.asc":input.sort==="high"?"min_usd_minor.desc,product_id.asc":"approved_at.desc,product_id.asc",limit:input.id?"1":"24",offset:input.id?"0":String((input.page-1)*24)});
 if(input.id)query.set("product_id","eq."+input.id);
 if(input.q)query.set("search_document","plfts(simple)."+input.q);
 if(input.category)query.set("category","eq."+input.category);
 return {input,path:"bidscope_shop_publications?"+query};
}
const stored=z.object({product_id:storefrontId,title:z.string(),description:z.string(),category:z.string(),image_url:z.string(),origin:z.string(),checked_at:z.string(),snapshot:z.object({variants:z.array(z.object({supplierId:storefrontId,name:z.string(),costUsdMinor:z.number().int().nonnegative()})).min(1).max(1000)})});
// Explicit public projection. Never spread database rows, source costs, evidence or actor IDs.
export function storefrontProduct(raw:unknown,fx:DailyFx|null,now=Date.now()){
 const row=stored.parse(raw);if(!cjPreviewImage(row.image_url))throw Error("Unapproved media origin.");
 const variants=row.snapshot.variants.map(v=>({id:v.supplierId,name:v.name,retailUsdMinor:retailUsdMinor(v.costUsdMinor),priceGhsMinor:fx?ghsMinor(retailUsdMinor(v.costUsdMinor),fx,now):null}));
 return publicProductSchema.parse({id:row.product_id,name:row.title,description:row.description,category:row.category,image:row.image_url,origin:row.origin,checkedAt:new Date(row.checked_at).toISOString(),variants,priceGhsMinor:fx?Math.min(...variants.map(v=>v.priceGhsMinor!)):null,fxAsOf:fx?.asOf??null,fxValidUntil:fx?.validUntil??null});
}
export function validReviewExpiry(value:string,now=Date.now()){
 const time=Date.parse(value);if(!Number.isFinite(time)||time<=now||time>now+366*86400000)throw Error("Rights review must expire within one year.");return new Date(time).toISOString();
}
