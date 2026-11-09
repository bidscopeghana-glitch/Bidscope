import {DatabaseSync} from "node:sqlite";
import {mkdirSync} from "node:fs";
import path from "node:path";
import {createHash,randomUUID} from "node:crypto";
import {checkoutReviewInput,type CheckoutReview,type CheckoutReviewInput,type ReviewRecord} from "../../commerce/checkout-review.ts";
import {retailUsdMinor} from "../../commerce/retail-pricing.ts";
import {ghsMinor,type DailyFx} from "./daily-fx.ts";
import type {CjShippingCheck} from "./cj-catalogue.ts";
import {ApiError} from "../api-error.ts";

type CheckedLine={productId:string;variantId:string;name:string;variantName:string;costUsdMinor:number;shipping:CjShippingCheck};
type Dependencies={check:(line:CheckoutReviewInput["lines"][number],input:CheckoutReviewInput)=>Promise<CheckedLine>;fx:()=>Promise<DailyFx>;imported:(id:string)=>boolean;now?:()=>number};
type Row={id:string;fingerprint:string;status:ReviewRecord["status"];created_at:string;review_json:string|null;error:string|null};
const maximumMinor=100_000_000;
function amount(value:number){if(!Number.isSafeInteger(value)||value<0||value>maximumMinor)throw Error("Manual pricing review required.");return value;}
function nullableAmount(value:number|null){return value===null?null:amount(value);}
function record(row:Row):ReviewRecord{return {id:row.id,status:row.status,createdAt:row.created_at,review:row.review_json?JSON.parse(row.review_json):null,error:row.error};}

// Workstation-only preparation ledger. It cannot charge, reserve stock or create
// supplier orders. This is not a replacement for the reviewed production schema.
export function openCheckoutReviews(deps:Dependencies,file=path.join(process.cwd(),".codex-tmp","commerce","checkout-reviews.sqlite")){
 mkdirSync(path.dirname(file),{recursive:true});const db=new DatabaseSync(file),now=deps.now||Date.now;
 db.exec("PRAGMA busy_timeout=5000;CREATE TABLE IF NOT EXISTS checkout_reviews(id TEXT PRIMARY KEY,request_key TEXT NOT NULL UNIQUE,fingerprint TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN('checking','held','failed')),created_at TEXT NOT NULL,review_json TEXT,error TEXT)");
 return {
  close(){db.close();},
  list(){return (db.prepare("SELECT * FROM checkout_reviews ORDER BY created_at DESC,id DESC LIMIT 20").all() as Row[]).map(record);},
  get(id:string){const row=db.prepare("SELECT * FROM checkout_reviews WHERE id=?").get(id) as Row|undefined;return row?record(row):null;},
  async prepare(raw:unknown){
   const input=checkoutReviewInput.parse(raw);
   const canonical={destination:input.destination,origin:input.origin,lines:[...input.lines].sort((a,b)=>JSON.stringify([a.productId,a.variantId]).localeCompare(JSON.stringify([b.productId,b.variantId])))};
   const fingerprint=createHash("sha256").update(JSON.stringify(canonical)).digest("hex"),id=randomUUID(),createdAt=new Date(now()).toISOString();
   const claim=db.prepare("INSERT OR IGNORE INTO checkout_reviews(id,request_key,fingerprint,status,created_at) SELECT ?,?,?,'checking',? WHERE NOT EXISTS(SELECT 1 FROM checkout_reviews WHERE status='checking' AND created_at>?)").run(id,input.requestKey,fingerprint,createdAt,new Date(now()-120000).toISOString());
   if(!claim.changes){
    const previous=db.prepare("SELECT * FROM checkout_reviews WHERE request_key=?").get(input.requestKey) as Row;
    if(!previous)throw new ApiError(429,"Another checkout review is being checked. Please wait for its saved result.","review_busy");
    if(previous.fingerprint!==fingerprint)throw new ApiError(409,"This review key was already used for a different selection.","review_key_conflict");
    const result=record(previous);
    if(result.review&&Date.parse(result.review.expiresAt)<=now())throw new ApiError(410,"This price review expired. Start a fresh review.","review_expired");
    if(result.status==="checking")throw new ApiError(409,"This review is already being checked. Reload the saved reviews before trying again.","review_in_progress");
    if(result.status==="failed")throw new ApiError(409,"The previous review failed. Inspect its saved result and start a fresh review when ready.","review_failed");
    return {record:result,duplicate:true};
   }
   try{
    const fx=await deps.fx(),lines:CheckoutReview["lines"]=[];
    for(const line of input.lines){
     if(!deps.imported(line.productId))throw Error("An item is outside the imported private catalogue.");
     const checked=await deps.check(line,input),shipping=checked.shipping;
     if(checked.productId!==line.productId||checked.variantId!==line.variantId||shipping.origin!==input.origin||shipping.destination!==input.destination||shipping.quantity!==line.quantity||shipping.stock.total<line.quantity)throw Error("Supplier mapping, stock or delivery check did not match.");
     if(!Number.isFinite(Date.parse(shipping.checkedAt))||Date.parse(shipping.checkedAt)>now()+300000||now()-Date.parse(shipping.checkedAt)>60000)throw Error("The stock and shipping response is stale.");
     const choices=shipping.routes.map(route=>{
      amount(route.shippingUsdMinor);nullableAmount(route.taxUsdMinor);nullableAmount(route.clearanceUsdMinor);nullableAmount(route.totalPostageUsdMinor);
      const known=amount(route.shippingUsdMinor+(route.taxUsdMinor??0)+(route.clearanceUsdMinor??0));
      if(route.totalPostageUsdMinor!==null&&route.totalPostageUsdMinor<known)throw Error("Supplier postage components do not reconcile.");
      return {route,postage:amount(route.totalPostageUsdMinor??known)};
     }).sort((a,b)=>a.postage-b.postage);
     const selected=line.service?choices.find(choice=>choice.route.name===line.service):choices[0];
     if(!selected)throw Error("No current delivery service is available for this selection.");
     const unit=retailUsdMinor(checked.costUsdMinor),route=selected.route;
     lines.push({productId:line.productId,variantId:line.variantId,name:checked.name,variantName:checked.variantName,quantity:line.quantity,unitUsdMinor:amount(unit),merchandiseUsdMinor:amount(unit*line.quantity),service:route.name,estimate:route.estimate,freightUsdMinor:route.shippingUsdMinor,providerTaxUsdMinor:route.taxUsdMinor,clearanceUsdMinor:route.clearanceUsdMinor,postageUsdMinor:selected.postage,checkedAt:shipping.checkedAt});
    }
    const merchandise=amount(lines.reduce((sum,line)=>sum+line.merchandiseUsdMinor,0)),postage=amount(lines.reduce((sum,line)=>sum+line.postageUsdMinor,0)),knownSubtotal=amount(merchandise+postage);
    const expiresAt=new Date(Math.min(now()+300000,Date.parse(createdAt)+300000,Date.parse(fx.validUntil))).toISOString();
    if(Date.parse(expiresAt)<=now())throw Error("The review expired while supplier checks were running.");
    const review:CheckoutReview={id,mode:"private_review",status:"held",destination:input.destination,origin:input.origin,createdAt,expiresAt,lines,merchandiseUsdMinor:merchandise,postageUsdMinor:postage,knownSubtotalUsdMinor:knownSubtotal,knownSubtotalGhsMinor:ghsMinor(knownSubtotal,fx,now()),fxAsOf:fx.asOf,fxValidUntil:fx.validUntil,paymentFeeGhsMinor:null,destinationDutyGhsMinor:null,payableGhsMinor:null,checkoutEnabled:false,blockers:["Catalogue publication permissions are pending review.","Payment fees and destination duty/tax treatment are not configured.","A complete delivery address, seller terms and production payment/fulfilment validation are required."]};
    if(lines.some(line=>line.providerTaxUsdMinor===null||line.clearanceUsdMinor===null))review.blockers.push("Some provider tax or clearance components were not supplied; the known subtotal is incomplete.");
    db.prepare("UPDATE checkout_reviews SET status='held',review_json=? WHERE id=?").run(JSON.stringify(review),id);
    return {record:{id,status:"held",createdAt,review,error:null} satisfies ReviewRecord,duplicate:false};
   }catch(error){
    // Do not persist raw provider responses, credentials, addresses or errors.
    const message="Supplier price, stock, shipping or currency validation failed. No payment or supplier order was created.";
    db.prepare("UPDATE checkout_reviews SET status='failed',error=? WHERE id=?").run(message,id);
    throw error instanceof ApiError?error:new ApiError(422,message,"review_validation_failed");
   }
  },
 };
}
