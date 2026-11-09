import {cjPreviewImage} from "./cj-preview.ts";
import type {CatalogueItem} from "./catalogue.ts";
import type {CjDraft} from "../server/commerce/cj-catalogue.ts";
export type ProductPresentation={item:CatalogueItem;product:CjDraft;images:string[];description:string;material:string;weight:string;ghsPrices?:Record<string,number>;fxAsOf?:string};
export function plainProductText(value:unknown,max=5000){
 if(typeof value!=="string")return "";
 return value.slice(0,100000).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,"").replace(/<br\s*\/?\s*>|<\/p\s*>|<\/li\s*>/gi,"\n").replace(/<[^>]*>/g,"").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/g,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/[ \t]+/g," ").replace(/\n\s*\n/g,"\n").trim().slice(0,max);
}
export function productPresentation(item:CatalogueItem,product:CjDraft,raw:unknown):ProductPresentation{
 if(item.supplierId!==product.supplierId)throw Error("Supplier product mapping mismatch.");
 const data=raw as Record<string,unknown>;
 const candidates=[data.bigImage,data.productImage,...(Array.isArray(data.productImageSet)?data.productImageSet:[]),item.image];
 const images=[...new Set(candidates.filter((v):v is string=>typeof v==="string").map(cjPreviewImage).filter((v):v is string=>Boolean(v)))].slice(0,12);
 let material=data.materialNameEnSet||data.materialNameEn;
 if(typeof material==="string"){try{material=JSON.parse(material);}catch{}}
 const materialText=Array.isArray(material)?material.filter(v=>typeof v==="string").join(", "):material;
 return {item,product,images,description:plainProductText(data.description),material:plainProductText(materialText,200),weight:typeof data.productWeight==="number"&&data.productWeight>=0?String(data.productWeight):plainProductText(data.productWeight,100)};
}
