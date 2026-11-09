import {createHash} from "node:crypto";
export type Permission={approved:boolean;evidence:string;expiresAt:string;productIds:string[];mediaAllowed:boolean};
export type SupplierLine={variantId:string;quantity:number};
export type Address={name:string;phone:string;countryCode:string;country:string;province:string;city:string;postalCode:string;address:string};
export type SupplierOrderInput={merchantReference:string;lines:SupplierLine[];address:Address;origin:string;logisticName:string};
export interface SourcingProvider{
 readonly id:"cj"|"alibaba";
 product(id:string):Promise<unknown>;
 stock(variantId:string):Promise<unknown>;
 freight(origin:string,destination:string,lines:SupplierLine[]):Promise<unknown>;
 createSandboxOrder(input:SupplierOrderInput):Promise<unknown>;
 order(providerOrderId:string):Promise<unknown>;
}
export function supplierMappingId(provider:string,productId:string,variantId:string){return createHash("sha256").update(JSON.stringify([provider,productId,variantId])).digest("hex");}
export class CjSandboxProvider implements SourcingProvider{
 readonly id="cj" as const;
 private token:string;
 private tokenExpiresAt:string;
 private permission:Permission;
 private transport:typeof fetch;
 constructor(token:string,tokenExpiresAt:string,permission:Permission,transport:typeof fetch=fetch){this.token=token;this.tokenExpiresAt=tokenExpiresAt;this.permission=permission;this.transport=transport;}
 private async call(path:string,body?:unknown){
  if(!this.token||!Number.isFinite(Date.parse(this.tokenExpiresAt))||Date.parse(this.tokenExpiresAt)<=Date.now())throw Error("CJ server token missing or expired.");
  if(!this.permission.approved||!this.permission.evidence||!Number.isFinite(Date.parse(this.permission.expiresAt))||Date.parse(this.permission.expiresAt)<=Date.now())throw Error("CJ account permission evidence is required.");
  const response=await this.transport("https://developers.cjdropshipping.com/api2.0/v1/"+path,{method:body?"POST":"GET",headers:{"CJ-Access-Token":this.token,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000),cache:"no-store",redirect:"error"});
  const result=await response.json() as {code?:number;result?:boolean;data?:unknown};
  if(!response.ok||result.result===false||result.code!==undefined&&![0,200].includes(result.code))throw Error("CJ request failed. Reconcile before retrying order writes.");
  return result.data;
 }
 product(id:string){if(!this.permission.productIds.includes(id))throw Error("Product is outside the approved publication scope.");return this.call("product/query?pid="+encodeURIComponent(id));}
 stock(id:string){return this.call("product/stock/queryByVid?vid="+encodeURIComponent(id));}
 freight(origin:string,destination:string,lines:SupplierLine[]){if(!/^[A-Z]{2}$/.test(origin)||!/^[A-Z]{2}$/.test(destination)||!lines.length||lines.some(l=>!l.variantId||!Number.isInteger(l.quantity)||l.quantity<1))throw Error("Invalid freight request.");return this.call("logistic/freightCalculate",{startCountryCode:origin,endCountryCode:destination,products:lines.map(l=>({vid:l.variantId,quantity:l.quantity}))});}
 createSandboxOrder(input:SupplierOrderInput){
  if(!input.merchantReference.startsWith("BIDSCOPE-SANDBOX-")||!input.lines.length||input.lines.some(l=>!l.variantId||!Number.isInteger(l.quantity)||l.quantity<1))throw Error("Valid sandbox reference and variant quantities required.");
  const a=input.address;
  if(![a.name,a.phone,a.countryCode,a.country,a.city,a.address,input.origin,input.logisticName].every(Boolean))throw Error("Validated shipping address and freight route required.");
  // No balance payment endpoint exists in this adapter. CJ defaults sandbox off,
  // so enforce isSandbox=1 and payType=3 after all caller input is mapped.
  return this.call("shopping/order/createOrderV3",{orderNumber:input.merchantReference,shippingCustomerName:a.name,shippingPhone:a.phone,shippingCountryCode:a.countryCode,shippingCountry:a.country,shippingProvince:a.province,shippingCity:a.city,shippingZip:a.postalCode,shippingAddress:a.address,fromCountryCode:input.origin,logisticName:input.logisticName,products:input.lines.map(l=>({vid:l.variantId,quantity:l.quantity})),isSandbox:1,payType:3});
 }
 order(id:string){return this.call("shopping/order/getOrderDetail?orderId="+encodeURIComponent(id));}
}
export function alibabaProvider():never{throw Error("Alibaba adapter is unavailable until authorised partner API access, scopes, terms and Ghana coverage are verified.");}
