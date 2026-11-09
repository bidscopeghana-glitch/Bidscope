import {z} from "zod";
import {cjPreviewImage} from "./cj-preview.ts";
export const catalogueItemSchema=z.object({supplierId:z.string().min(1).max(200),name:z.string().min(1).max(1000),sku:z.string().max(200),category:z.string().max(1000),categoryId:z.string().max(200),image:z.string().refine(v=>Boolean(cjPreviewImage(v))),priceText:z.string().max(100),minUsdMinor:z.number().int().nonnegative().nullable(),maxUsdMinor:z.number().int().nonnegative().nullable(),checkedAt:z.string().datetime()});
export type CatalogueItem=z.infer<typeof catalogueItemSchema>;
export function priceRange(value:string){
 const match=value.trim().match(/^(\d+(?:\.\d{1,2})?)(?:\s*-+\s*(\d+(?:\.\d{1,2})?))?$/);
 if(!match)return {min:null,max:null};
 const min=Math.round(Number(match[1])*100),max=Math.round(Number(match[2]||match[1])*100);
 return Number.isSafeInteger(min)&&Number.isSafeInteger(max)&&max>=min?{min,max}:{min:null,max:null};
}
export function catalogueItem(raw:unknown,category:{id:string;name:string}):CatalogueItem|null{
 const parsed=z.object({id:z.string(),nameEn:z.string(),sku:z.string().nullish(),bigImage:z.string(),sellPrice:z.union([z.string(),z.number()]).nullish(),saleStatus:z.union([z.string(),z.number()]).optional()}).safeParse(raw);
 if(!parsed.success||parsed.data.saleStatus!==undefined&&String(parsed.data.saleStatus)!=="3")return null;
 const p=parsed.data,priceText=String(p.sellPrice??""),range=priceRange(priceText);
 const result=catalogueItemSchema.safeParse({supplierId:p.id,name:p.nameEn,sku:p.sku||"",category:category.name,categoryId:category.id,image:p.bigImage,priceText,minUsdMinor:range.min,maxUsdMinor:range.max,checkedAt:new Date().toISOString()});
 return result.success?result.data:null;
}
export type CatalogueState={target:number;categoryIndex:number;page:number;status:"running"|"paused"|"complete"|"exhausted"|"error";reason:string;updatedAt:string;categories:{id:string;name:string}[];quota:{remaining:number;total:number;usedToday:number}|null;orderingVersion?:number};
export function interleaveDepartments(categories:{id:string;name:string}[]){
 const groups=new Map<string,{id:string;name:string}[]>();for(const category of categories){const key=category.name.split(" / ")[0];const list=groups.get(key)||[];list.push(category);groups.set(key,list);}
 const result:{id:string;name:string}[]=[];let more=true;while(more){more=false;for(const list of groups.values()){const next=list.shift();if(next){result.push(next);more=true;}}}return result;
}
