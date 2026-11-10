import {z} from "zod";
import {deliveryDestinations} from "../../commerce/retail-pricing.ts";
import type {SupplierOrderInput} from "./providers.ts";
const identifier=z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/);
export const supplierPayload=z.object({productId:identifier,variantId:identifier,quantity:z.number().int().min(1).max(99),origin:z.string().regex(/^[A-Z]{2}$/),destination:z.string().regex(/^[A-Z]{2}$/),service:z.string().min(1).max(200),supplierUnitUsdMinor:z.number().int().nonnegative(),postageUsdMinor:z.number().int().nonnegative()});
export function sandboxSupplierInput(merchantReference:string,payload:unknown,address:unknown):SupplierOrderInput{
 const line=supplierPayload.parse(payload);
 const a=z.object({name:z.string().min(1).max(100),phone:z.string().min(7).max(25),countryCode:z.string(),province:z.string().max(100),city:z.string().min(1).max(100),postalCode:z.string().max(30),address:z.string().min(5).max(200)}).parse(address);
 if(!/^BIDSCOPE-SANDBOX-[a-f0-9]{24}$/.test(merchantReference)||a.countryCode!==line.destination)throw Error("Sandbox supplier mapping mismatch.");
 const country=deliveryDestinations.find(([code])=>code===a.countryCode)?.[1];if(!country)throw Error("Destination not supported by this test.");
 return {merchantReference,lines:[{variantId:line.variantId,quantity:line.quantity}],address:{...a,country},origin:line.origin,logisticName:line.service};
}
export function checkedSandboxOrder(raw:unknown,expectedReference:string,expectedProviderId?:string){
 const order=z.object({orderId:identifier,orderNum:z.string(),isSandbox:z.union([z.literal(1),z.literal("1")]),orderStatus:z.enum(["CREATED","IN_CART","UNPAID","PENDING","PROCESSING","UNSHIPPED","SHIPPED","DELIVERED"]),subStatus:z.string().nullish(),trackNumber:z.string().nullish(),trackingProvider:z.string().nullish()}).parse(raw);
 const cjAlias=Boolean(expectedProviderId&&/^(SD|DP)\d{8,100}$/.test(expectedProviderId)&&/^\d{8,100}$/.test(order.orderId));
 if(order.orderNum!==expectedReference||expectedProviderId&&order.orderId!==expectedProviderId&&!cjAlias)throw Error("Supplier response does not match this sandbox order.");
 return order;
}
export function nextSandboxStatus(status:string,subStatus?:string|null):number|null{
 if(status==="PENDING"||status==="UNSHIPPED"&&subStatus==="PENDING")return 400;if(status==="PROCESSING"||status==="UNSHIPPED")return 500;if(status==="SHIPPED")return 600;return null;
}
