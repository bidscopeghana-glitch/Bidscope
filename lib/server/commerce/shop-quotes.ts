import {shopQuoteInput,checkoutCostPolicy,shopReturnDisclosure,type ShopQuoteInput} from "../../commerce/shop-checkout.ts";
import {retailUsdMinor} from "../../commerce/retail-pricing.ts";
import {ghsMinor,type DailyFx} from "./daily-fx.ts";
import type {CjShippingCheck} from "./cj-catalogue.ts";
type Checked={productId:string;variantId:string;name:string;variantName:string;costUsdMinor:number;shipping:CjShippingCheck};
type Dependencies={exists:(id:string)=>Promise<boolean>;check:(line:ShopQuoteInput["lines"][number],input:ShopQuoteInput)=>Promise<Checked>;fx:()=>Promise<DailyFx>;now?:()=>number};
const money=(value:number)=>{if(!Number.isSafeInteger(value)||value<0||value>100000000)throw Error("Pricing needs manual review.");return value;};
export async function buildSandboxShopQuote(raw:unknown,deps:Dependencies){
 const input=shopQuoteInput.parse(raw),now=deps.now||Date.now,started=now(),fx=await deps.fx();
 const items:{name:string;variant:string;quantity:number;unitGhsMinor:number}[]=[],fulfilment:Record<string,unknown>[]=[];
 let merchandise=0,shipping=0,supplierCostUsd=0;
 for(const line of input.lines){
  if(!await deps.exists(line.productId))throw Error("Product is outside the private catalogue.");
  const checked=await deps.check(line,input),s=checked.shipping;
  if(checked.productId!==line.productId||checked.variantId!==line.variantId||s.origin!==input.origin||s.destination!==input.address.countryCode||s.quantity!==line.quantity||s.stock.total<line.quantity)throw Error("Product, stock or shipping did not match.");
  if(!Number.isFinite(Date.parse(s.checkedAt))||Date.parse(s.checkedAt)>now()+300000||now()-Date.parse(s.checkedAt)>180000)throw Error("Supplier check is stale.");
  const routes=s.routes.map(route=>{
   const components=money(money(route.shippingUsdMinor)+money(route.taxUsdMinor??0)+money(route.clearanceUsdMinor??0));
   // A complete supplier postage total is required; absent fee components are disclosed.
   if(route.totalPostageUsdMinor===null&&(route.taxUsdMinor===null||route.clearanceUsdMinor===null))throw Error("Supplier shipping charges are incomplete.");
   const postage=route.totalPostageUsdMinor===null?components:money(route.totalPostageUsdMinor);
   if(postage<components||!route.name||!route.estimate)throw Error("Shipping breakdown is inconsistent.");
   return {...route,postage};
  }).sort((a,b)=>a.postage-b.postage);
  const route=routes[0];if(!route)throw Error("No shipping service is available for this selection.");
  const unit=ghsMinor(retailUsdMinor(checked.costUsdMinor),fx,now());
  merchandise=money(merchandise+money(unit*line.quantity));shipping=money(shipping+ghsMinor(route.postage,fx,now()));supplierCostUsd=money(supplierCostUsd+money(checked.costUsdMinor*line.quantity));
  items.push({name:checked.name,variant:checked.variantName,quantity:line.quantity,unitGhsMinor:unit});
  fulfilment.push({productId:line.productId,variantId:line.variantId,quantity:line.quantity,origin:input.origin,destination:input.address.countryCode,service:route.name,estimate:route.estimate,supplierUnitUsdMinor:checked.costUsdMinor,postageUsdMinor:route.postage,providerTaxUsdMinor:route.taxUsdMinor,clearanceUsdMinor:route.clearanceUsdMinor,checkedAt:s.checkedAt});
 }
 const expiresAt=Math.min(started+300000,Date.parse(fx.validUntil));if(expiresAt<=now())throw Error("The quote expired during supplier checks.");
 const total=money(merchandise+shipping);if(total<1)throw Error("Quote total is invalid.");
 return {input,mode:"test" as const,sale_ready:false,currency:"GHS" as const,merchandise_minor:merchandise,shipping_minor:shipping,included_tax_minor:0,customer_fee_minor:checkoutCostPolicy.customerProcessingFeeMinor,total_minor:total,import_charges_policy:checkoutCostPolicy.importChargesPolicy,items,fulfilment_snapshot:{provider:"cj",lines:fulfilment,supplierCostUsdMinor:supplierCostUsd,fxAsOf:fx.asOf,fxValidUntil:fx.validUntil,merchantProcessingFee:"absorbed_actual_cost_pending",returnDisclosure:{version:shopReturnDisclosure.version,text:shopReturnDisclosure.copy,acknowledgedAt:new Date(started).toISOString()}},delivery_address:input.address,created_at:new Date(started).toISOString(),expires_at:new Date(expiresAt).toISOString()};
}
