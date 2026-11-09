import {createHash} from "node:crypto";
import {z} from "zod";
import type {CjToken} from "./cj-auth.ts";

const identifier=z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/);
const amount=z.union([z.number(),z.string().regex(/^\d+(\.\d{1,2})?$/)]).transform(Number).pipe(z.number().finite().nonnegative().max(1_000_000));
const variantSchema=z.object({vid:identifier,pid:identifier.optional(),variantNameEn:z.string().nullable().optional(),variantKey:z.string().nullable().optional(),variantSku:z.string().optional(),variantSellPrice:amount});
const productSchema=z.object({pid:identifier,productNameEn:z.string().min(1).max(1000),productSku:z.string().optional(),categoryName:z.string().nullable().optional(),variants:z.array(variantSchema).min(1).max(1000)});
export type CjDraft={provider:"cj";id:string;supplierId:string;name:string;sku:string;category:string;checkedAt:string;publication:"unreviewed";mediaAllowed:false;variants:{id:string;supplierId:string;name:string;sku:string;costUsdMinor:number}[]};
export type CjShippingCheck={checkedAt:string;origin:string;destination:string;quantity:number;stock:{total:number;warehouse:number;factory:number};routes:{name:string;estimate:string;shippingUsdMinor:number;taxUsdMinor:number|null;clearanceUsdMinor:number|null;totalPostageUsdMinor:number|null}[];checkoutEnabled:false};
function mapping(product:string,variant:string){return createHash("sha256").update(JSON.stringify(["cj",product,variant])).digest("hex");}
function cents(value:number){return Math.round(value*100);}
export function normalizeCjDraft(raw:unknown,now=new Date().toISOString()):CjDraft{
 const p=productSchema.parse(raw);
 if(new Set(p.variants.map(v=>v.vid)).size!==p.variants.length||p.variants.some(v=>v.pid&&v.pid!==p.pid))throw Error("CJ returned inconsistent variant mappings.");
 return {provider:"cj",id:mapping(p.pid,"product"),supplierId:p.pid,name:p.productNameEn,sku:p.productSku||"",category:p.categoryName||"Uncategorised",checkedAt:now,publication:"unreviewed",mediaAllowed:false,variants:p.variants.map(v=>({id:mapping(p.pid,v.vid),supplierId:v.vid,name:v.variantNameEn||v.variantKey||v.variantSku||v.vid,sku:v.variantSku||"",costUsdMinor:cents(v.variantSellPrice)}))};
}

// Private local account inspection only. No public catalogue, media, order or payment methods.
export function createCjCatalogueInspector(token:()=>Promise<CjToken>,transport:typeof fetch=fetch){
 async function call(path:string,body?:unknown){
  const credentials=await token();
  if(!credentials.accessToken||Date.parse(credentials.accessTokenExpiryDate)<=Date.now()||!Number.isFinite(Date.parse(credentials.accessTokenExpiryDate)))throw Error("CJ token is not usable.");
  const response=await transport("https://developers.cjdropshipping.com/api2.0/v1/"+path,{method:body?"POST":"GET",headers:{"CJ-Access-Token":credentials.accessToken,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined,redirect:"error",cache:"no-store",signal:AbortSignal.timeout(20000)});
  const result=await response.json() as {code?:number;result?:boolean;data?:unknown};
  if(!response.ok||result.code!==200||result.result!==true)throw Error("CJ could not complete this product check. No order was placed.");
  return result.data;
 }
 async function product(productId:string){return normalizeCjDraft(await call("product/query?pid="+encodeURIComponent(identifier.parse(productId))));}
 return {
  async search(keyword:string){
   const query=z.string().trim().min(2).max(100).parse(keyword);
   const raw=await call("product/listV2?"+new URLSearchParams({page:"1",size:"12",keyWord:query}));
   const data=z.object({content:z.array(z.object({productList:z.array(z.object({id:identifier,nameEn:z.string(),sku:z.string().optional(),sellPrice:z.string().optional()}))}))}).parse(raw);
   return data.content.flatMap(group=>group.productList).slice(0,12).map(p=>({supplierId:p.id,name:p.nameEn,sku:p.sku||"",priceRangeUsd:p.sellPrice||"Unquoted"}));
  },
  product,
  async shipping(productId:string,variantId:string,origin:string,quantity:number):Promise<CjShippingCheck>{
   identifier.parse(variantId);z.string().regex(/^[A-Z]{2}$/).parse(origin);z.number().int().min(1).max(999).parse(quantity);
   const draft=await product(productId);
   if(!draft.variants.some(v=>v.supplierId===variantId))throw Error("Variant does not belong to this product.");
   const rawStock=await call("product/stock/queryByVid?vid="+encodeURIComponent(variantId));
   const stocks=z.array(z.object({vid:identifier,countryCode:z.string(),totalInventoryNum:z.number().int().nonnegative(),cjInventoryNum:z.number().int().nonnegative(),factoryInventoryNum:z.number().int().nonnegative()})).parse(rawStock).filter(s=>s.vid===variantId&&s.countryCode===origin);
   const stock=stocks.reduce((n,s)=>({total:n.total+s.totalInventoryNum,warehouse:n.warehouse+s.cjInventoryNum,factory:n.factory+s.factoryInventoryNum}),{total:0,warehouse:0,factory:0});
   if(stock.total<quantity)throw Error("Insufficient reported stock at the selected origin. Choose another route or product.");
   const rawFreight=await call("logistic/freightCalculate",{startCountryCode:origin,endCountryCode:"GH",products:[{vid:variantId,quantity}]});
   const routes=z.array(z.object({logisticName:z.string().min(1),logisticAging:z.string(),logisticPrice:amount,taxesFee:amount.nullish(),clearanceOperationFee:amount.nullish(),totalPostageFee:amount.nullish()})).parse(rawFreight).map(r=>({name:r.logisticName,estimate:r.logisticAging,shippingUsdMinor:cents(r.logisticPrice),taxUsdMinor:r.taxesFee==null?null:cents(r.taxesFee),clearanceUsdMinor:r.clearanceOperationFee==null?null:cents(r.clearanceOperationFee),totalPostageUsdMinor:r.totalPostageFee==null?null:cents(r.totalPostageFee)}));
   return {checkedAt:new Date().toISOString(),origin,destination:"GH",quantity,stock,routes,checkoutEnabled:false};
  }
 };
}
