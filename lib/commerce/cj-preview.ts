import {z} from "zod";
import type {Product} from "./core.ts";
import type {CjDraft} from "../server/commerce/cj-catalogue.ts";
// Exact auxiliary bucket hosts: product-center was observed in the authenticated
// CJ listV2 response; cc-west-usa appears in CJ's official product API example.
// This permits private image review only, never approval of publication rights.
const cjMediaBuckets=new Set(["cj-product-center.oss-accelerate.aliyuncs.com","cc-west-usa.oss-us-west-1.aliyuncs.com"]);
export function cjPreviewImage(value:string){
 try{const url=new URL(value);return url.protocol==="https:"&&!url.username&&!url.password&&!url.port&&(url.hostname==="cjdropshipping.com"||url.hostname.endsWith(".cjdropshipping.com")||cjMediaBuckets.has(url.hostname))?url.href:undefined;}catch{return undefined;}
}
export function cjStorefrontPreview(draft:CjDraft,image:string,category:string,art:Product["art"]):Product{
 const safeImage=cjPreviewImage(image);
 if(!safeImage)throw Error("CJ preview image origin is not approved.");
 return {id:"cj-"+draft.id,supplierId:draft.supplierId,provider:"cj",name:draft.name,category,description:`Supplier product ${draft.sku}. Choose a variant to see its current CJ reference price. Customer pricing, availability and delivery must be confirmed before sales open.`,origin:"Country of manufacture not verified",kind:"retail",art,permission:"unknown",evidence:"Official CJ API account preview only; public publication permission remains under review.",sample:false,image:safeImage,checkedAt:draft.checkedAt,variants:draft.variants.map(v=>({id:"cj-"+v.id,supplierId:v.supplierId,name:v.name,cost:v.costUsdMinor,stock:0}))};
}
const itemSchema=z.object({id:z.string().startsWith("cj-"),supplierId:z.string(),provider:z.literal("cj"),name:z.string(),category:z.string(),description:z.string(),origin:z.string(),kind:z.literal("retail"),art:z.enum(["lamp","bag","bottle","chair"]),permission:z.literal("unknown"),evidence:z.string(),sample:z.literal(false),image:z.string().refine(v=>Boolean(cjPreviewImage(v))),checkedAt:z.string().datetime(),variants:z.array(z.object({id:z.string().startsWith("cj-"),supplierId:z.string(),name:z.string(),cost:z.number().int().nonnegative(),stock:z.literal(0)})).min(1)});
export const cjPreviewFeedSchema=z.object({version:z.literal(1),mode:z.literal("private_cj_preview"),generatedAt:z.string().datetime(),items:z.array(itemSchema).max(12)});
