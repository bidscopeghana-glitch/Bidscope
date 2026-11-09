import {z} from "zod";
import {cjPreviewImage} from "./cj-preview.ts";
export const shoppingBagKey="bidscope-private-shopping-bag-v1";
export const bagLineSchema=z.object({productId:z.string().min(1).max(200),variantId:z.string().min(1).max(200),name:z.string().max(1000),variant:z.string().max(1000),image:z.string().refine(v=>Boolean(cjPreviewImage(v))),unitUsdMinor:z.number().int().nonnegative(),quantity:z.number().int().min(1).max(999)});
export type BagLine=z.infer<typeof bagLineSchema>;
export function readBag(value:string|null):BagLine[]{try{return z.array(bagLineSchema).max(100).parse(JSON.parse(value||"[]"));}catch{return [];}}
export function addBagLine(lines:BagLine[],input:BagLine){const line=bagLineSchema.parse(input);const existing=lines.find(p=>p.productId===line.productId&&p.variantId===line.variantId);if(existing){return lines.map(p=>p===existing?bagLineSchema.parse({...p,quantity:p.quantity+line.quantity}):p);}if(lines.length>=100)throw Error("Your bag is full. Review the items already added.");return [...lines,line];}
