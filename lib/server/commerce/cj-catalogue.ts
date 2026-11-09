import {createHash} from "node:crypto";
import {setTimeout as pause} from "node:timers/promises";
import {z} from "zod";
import type {CjToken} from "./cj-auth.ts";
import {waitForCjRequestStart} from "./cj-read-pacer.ts";

const identifier=z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/);
const amount=z.union([z.number(),z.string().regex(/^\d+(\.\d{1,2})?$/)]).transform(Number).pipe(z.number().finite().nonnegative().max(1_000_000));
const variantSchema=z.object({vid:identifier,pid:identifier.optional(),variantNameEn:z.string().nullable().optional(),variantKey:z.string().nullable().optional(),variantSku:z.string().optional(),variantSellPrice:amount});
const productSchema=z.object({pid:identifier,productNameEn:z.string().min(1).max(1000),productSku:z.string().optional(),categoryName:z.string().nullable().optional(),variants:z.array(variantSchema).min(1).max(1000)});
export type CjDraft={provider:"cj";id:string;supplierId:string;name:string;sku:string;category:string;checkedAt:string;publication:"unreviewed";mediaAllowed:false;variants:{id:string;supplierId:string;name:string;sku:string;costUsdMinor:number}[]};
export type CjShippingCheck={checkedAt:string;origin:string;destination:string;quantity:number;stock:{total:number;warehouse:number;factory:number};routes:{name:string;estimate:string;shippingUsdMinor:number;taxUsdMinor:number|null;clearanceUsdMinor:number|null;totalPostageUsdMinor:number|null}[];checkoutEnabled:false};
function mapping(product:string,variant:string){return createHash("sha256").update(JSON.stringify(["cj",product,variant])).digest("hex");}
function cents(value:number){return Math.round(value*100);}
export class CjReadError extends Error{readonly providerCode:number;constructor(code:number){super(code===429||code===16900500?"CJ quota is temporarily unavailable.":code===1600014?"CJ account API access requires reactivation.":"CJ catalogue read failed.");this.providerCode=code;}}
export function normalizeCjDraft(raw:unknown,now=new Date().toISOString()):CjDraft{
 const p=productSchema.parse(raw);
 if(new Set(p.variants.map(v=>v.vid)).size!==p.variants.length||p.variants.some(v=>v.pid&&v.pid!==p.pid))throw Error("CJ returned inconsistent variant mappings.");
 return {provider:"cj",id:mapping(p.pid,"product"),supplierId:p.pid,name:p.productNameEn,sku:p.productSku||"",category:p.categoryName||"Uncategorised",checkedAt:now,publication:"unreviewed",mediaAllowed:false,variants:p.variants.map(v=>({id:mapping(p.pid,v.vid),supplierId:v.vid,name:v.variantNameEn||v.variantKey||v.variantSku||v.vid,sku:v.variantSku||"",costUsdMinor:cents(v.variantSellPrice)}))};
}

// Private local account inspection only. No public catalogue, media, order or payment methods.
export function createCjCatalogueInspector(token:()=>Promise<CjToken>,transport:typeof fetch=fetch,minimumIntervalMs=1100){
 let tail=Promise.resolve(),lastStarted=0;
 let points:{remaining:number;total:number;usedToday:number}|null=null;
 async function call(path:string,body?:unknown){
  const previous=tail;let release!:()=>void;tail=new Promise<void>(resolve=>{release=resolve;});
  await previous;
  try{
  const credentials=await token();
  if(!credentials.accessToken||Date.parse(credentials.accessTokenExpiryDate)<=Date.now()||!Number.isFinite(Date.parse(credentials.accessTokenExpiryDate)))throw Error("CJ token is not usable.");
  if(process.env.BIDSCOPE_COMMERCE_LOCAL_SETUP==="1"&&minimumIntervalMs>0)await waitForCjRequestStart(minimumIntervalMs);else{const wait=minimumIntervalMs-(Date.now()-lastStarted);if(wait>0)await pause(wait);}
  lastStarted=Date.now();
  const response=await transport("https://developers.cjdropshipping.com/api2.0/v1/"+path,{method:body?"POST":"GET",headers:{"CJ-Access-Token":credentials.accessToken,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined,redirect:"error",cache:"no-store",signal:AbortSignal.timeout(20000)});
  const result=await response.json() as {code?:number;result?:boolean;data?:unknown;pointsInfo?:{remaining:number;total:number;usedToday:number}};
  // Some failed responses contain an all-zero placeholder, not an account quota.
  // Preserve the last usable snapshot; a real zero remaining quota has a positive
  // total and is still accepted. Provider errors keep their bounded retry policy.
  if(result.pointsInfo&&result.pointsInfo.total>0&&result.pointsInfo.remaining<=result.pointsInfo.total&&[result.pointsInfo.remaining,result.pointsInfo.total,result.pointsInfo.usedToday].every(n=>Number.isSafeInteger(n)&&n>=0))points=result.pointsInfo;
  if(!response.ok||result.code!==200||result.result!==true)throw new CjReadError(result.code||response.status);
  return result.data;
  }finally{release();}
 }
 async function product(productId:string){return normalizeCjDraft(await call("product/query?pid="+encodeURIComponent(identifier.parse(productId))));}
 return {
  quota(){return points;},
  async categories(){
   const data=await call("product/getCategory");
   const parsed=z.array(z.object({categoryFirstName:z.string(),categoryFirstList:z.array(z.object({categorySecondName:z.string(),categorySecondList:z.array(z.object({categoryId:identifier,categoryName:z.string()}))}))})).parse(data);
   return parsed.flatMap(first=>first.categoryFirstList.flatMap(second=>second.categorySecondList.map(leaf=>({id:leaf.categoryId,name:[first.categoryFirstName,second.categorySecondName,leaf.categoryName].join(" / ")}))));
  },
  async cataloguePage(categoryId:string,page:number,direction:"asc"|"desc"="asc"){
   identifier.parse(categoryId);z.number().int().min(1).max(60).parse(page);z.enum(["asc","desc"]).parse(direction);
   const raw=await call("product/listV2?"+new URLSearchParams({categoryId,page:String(page),size:"100",features:"enable_category",sort:direction,orderBy:"3"}));
   const parsed=z.object({totalPages:z.number(),content:z.array(z.object({productList:z.array(z.unknown())}))}).parse(raw);
   return {totalPages:Math.min(60,parsed.totalPages),items:parsed.content.flatMap(g=>g.productList)};
  },
  async preview(productId:string){
   const raw=await call("product/query?pid="+encodeURIComponent(identifier.parse(productId)));
   const draft=normalizeCjDraft(raw);
   const media=z.object({bigImage:z.string().nullish(),productImage:z.string().nullish(),productImageSet:z.array(z.string()).nullish()}).parse(raw);
   return {draft,image:media.bigImage||media.productImage||media.productImageSet?.[0]||""};
  },
  async search(keyword:string){
   const query=z.string().trim().min(2).max(100).parse(keyword);
   const raw=await call("product/listV2?"+new URLSearchParams({page:"1",size:"12",keyWord:query}));
   const data=z.object({content:z.array(z.object({productList:z.array(z.object({id:identifier,nameEn:z.string(),sku:z.string().optional(),sellPrice:z.string().optional()}))}))}).parse(raw);
   return data.content.flatMap(group=>group.productList).slice(0,12).map(p=>({supplierId:p.id,name:p.nameEn,sku:p.sku||"",priceRangeUsd:p.sellPrice||"Unquoted"}));
  },
  product,
  async details(productId:string){const raw=await call("product/query?pid="+encodeURIComponent(identifier.parse(productId)));return {draft:normalizeCjDraft(raw),raw};},
  async shipping(productId:string,variantId:string,origin:string,quantity:number,destination="GH"):Promise<CjShippingCheck>{
   identifier.parse(variantId);z.string().regex(/^[A-Z]{2}$/).parse(origin);z.string().regex(/^[A-Z]{2}$/).parse(destination);z.number().int().min(1).max(999).parse(quantity);
   const draft=await product(productId);
   if(!draft.variants.some(v=>v.supplierId===variantId))throw Error("Variant does not belong to this product.");
   const rawStock=await call("product/stock/queryByVid?vid="+encodeURIComponent(variantId));
   const stocks=z.array(z.object({vid:identifier,countryCode:z.string(),totalInventoryNum:z.number().int().nonnegative(),cjInventoryNum:z.number().int().nonnegative(),factoryInventoryNum:z.number().int().nonnegative()})).parse(rawStock).filter(s=>s.vid===variantId&&s.countryCode===origin);
   const stock=stocks.reduce((n,s)=>({total:n.total+s.totalInventoryNum,warehouse:n.warehouse+s.cjInventoryNum,factory:n.factory+s.factoryInventoryNum}),{total:0,warehouse:0,factory:0});
   if(stock.total<quantity)throw Error("Insufficient reported stock at the selected origin. Choose another route or product.");
   const rawFreight=await call("logistic/freightCalculate",{startCountryCode:origin,endCountryCode:destination,products:[{vid:variantId,quantity}]});
   const routes=z.array(z.object({logisticName:z.string().min(1),logisticAging:z.string(),logisticPrice:amount,taxesFee:amount.nullish(),clearanceOperationFee:amount.nullish(),totalPostageFee:amount.nullish()})).parse(rawFreight).map(r=>({name:r.logisticName,estimate:r.logisticAging,shippingUsdMinor:cents(r.logisticPrice),taxUsdMinor:r.taxesFee==null?null:cents(r.taxesFee),clearanceUsdMinor:r.clearanceOperationFee==null?null:cents(r.clearanceOperationFee),totalPostageUsdMinor:r.totalPostageFee==null?null:cents(r.totalPostageFee)}));
   return {checkedAt:new Date().toISOString(),origin,destination,quantity,stock,routes,checkoutEnabled:false};
  }
 };
}
