import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {openCheckoutReviews} from "../../lib/server/commerce/checkout-review-store.ts";
import {checkoutReviewInput,type CheckoutReviewInput} from "../../lib/commerce/checkout-review.ts";
import {ApiError} from "../../lib/server/api-error.ts";
import type {CjShippingCheck} from "../../lib/server/commerce/cj-catalogue.ts";

const epoch=Date.UTC(2026,10,9,12);
const input=():CheckoutReviewInput=>({requestKey:randomUUID(),destination:"GB",origin:"CN",lines:[{productId:"p1",variantId:"v1",quantity:2}]});
function fixture(){
 const directory=mkdtempSync(path.join(tmpdir(),"bidscope-review-")),file=path.join(directory,"reviews.sqlite");let now=epoch,calls=0;
 const shipping:CjShippingCheck={checkedAt:new Date(epoch).toISOString(),origin:"CN",destination:"GB",quantity:2,stock:{total:10,warehouse:10,factory:0},routes:[{name:"Fast",estimate:"3-5",shippingUsdMinor:900,taxUsdMinor:0,clearanceUsdMinor:0,totalPostageUsdMinor:900},{name:"Standard",estimate:"5-9",shippingUsdMinor:500,taxUsdMinor:null,clearanceUsdMinor:0,totalPostageUsdMinor:500}],checkoutEnabled:false};
 const dependencies={now:()=>now,imported:(id:string):boolean=>id==="p1",fx:async()=>({rateMicros:10_000_000,asOf:new Date(epoch-1000).toISOString(),validUntil:new Date(epoch+3600000).toISOString()}),check:async(line:CheckoutReviewInput["lines"][number])=>{calls++;return {productId:line.productId,variantId:line.variantId,name:"Current supplier name",variantName:"Blue",costUsdMinor:1000,shipping};}};
 return {file,dependencies,shipping,get calls(){return calls;},advance(ms:number){now+=ms;},dispose(){rmSync(directory,{recursive:true,force:true});}};
}
test("checkout reviews use current supplier costs, separate charges and persist a non-payable held result",async()=>{
 const f=fixture(),s=openCheckoutReviews(f.dependencies,f.file),request=input();try{
  const first=await s.prepare(request),review=first.record.review!;
  assert.equal(review.lines[0].unitUsdMinor,1300);assert.equal(review.merchandiseUsdMinor,2600);assert.equal(review.postageUsdMinor,500);assert.equal(review.knownSubtotalGhsMinor,31000);
  assert.equal(review.paymentFeeGhsMinor,null);assert.equal(review.destinationDutyGhsMinor,null);assert.equal(review.payableGhsMinor,null);assert.equal(review.checkoutEnabled,false);assert.equal(review.status,"held");
  assert.ok(review.blockers.some(reason=>reason.includes("not supplied")));assert.equal(f.calls,1);
  const duplicate=await s.prepare(request);assert.equal(duplicate.record.id,first.record.id);assert.equal(duplicate.duplicate,true);assert.equal(f.calls,1);assert.equal(s.list().length,1);
  const reopened=openCheckoutReviews(f.dependencies,f.file);try{assert.equal(reopened.get(review.id)?.review?.knownSubtotalUsdMinor,3100);}finally{reopened.close();}
 }finally{s.close();f.dispose();}
});
test("checkout schema rejects browser prices, duplicate mappings, unsupported destinations and excessive lines",()=>{
 const request=input();assert.throws(()=>checkoutReviewInput.parse({...request,total:1}));assert.throws(()=>checkoutReviewInput.parse({...request,lines:[{...request.lines[0],unitUsdMinor:1}]}));assert.throws(()=>checkoutReviewInput.parse({...request,lines:[...request.lines,...request.lines]}));assert.throws(()=>checkoutReviewInput.parse({...request,destination:"ZZ"}));assert.throws(()=>checkoutReviewInput.parse({...request,lines:Array.from({length:6},(_,i)=>({...request.lines[0],variantId:"v"+i}))}));
});
test("review request keys cannot be replayed with changed quantities or used after expiry",async()=>{
 const f=fixture(),s=openCheckoutReviews(f.dependencies,f.file),request=input();try{
  await s.prepare(request);await assert.rejects(s.prepare({...request,lines:[{...request.lines[0],quantity:3}]}),(error:unknown)=>error instanceof ApiError&&error.status===409);
  f.advance(300001);await assert.rejects(s.prepare(request),(error:unknown)=>error instanceof ApiError&&error.status===410);assert.equal(f.calls,1);
 }finally{s.close();f.dispose();}
});
test("unavailable routes, stock, mappings, stale reads and unreconciled postage fail closed with a saved exception",async()=>{
 for(const mutate of [
  (f:ReturnType<typeof fixture>)=>{f.shipping.routes=[];},
  (f:ReturnType<typeof fixture>)=>{f.shipping.stock.total=1;},
  (f:ReturnType<typeof fixture>)=>{f.shipping.destination="US";},
  (f:ReturnType<typeof fixture>)=>{f.shipping.checkedAt=new Date(epoch-61000).toISOString();},
  (f:ReturnType<typeof fixture>)=>{f.shipping.routes[0].totalPostageUsdMinor=1;},
 ]){const f=fixture();mutate(f);const s=openCheckoutReviews(f.dependencies,f.file),request=input();try{await assert.rejects(s.prepare(request));assert.equal(s.list()[0].status,"failed");assert.equal(s.list()[0].review,null);await assert.rejects(s.prepare(request));assert.equal(f.calls,1);}finally{s.close();f.dispose();}}
});
test("explicit carrier selection is preserved and missing selected carriers are rejected",async()=>{
 const f=fixture(),s=openCheckoutReviews(f.dependencies,f.file);try{const request=input();request.lines[0].service="Fast";assert.equal((await s.prepare(request)).record.review?.postageUsdMinor,900);request.requestKey=randomUUID();request.lines[0].service="Missing";await assert.rejects(s.prepare(request));}finally{s.close();f.dispose();}
});
test("concurrent requests and other processes share the SQLite admission gate",async()=>{
 const f=fixture();let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;}),base=f.dependencies.check;
 f.dependencies.check=async line=>{await gate;return base(line);};const s=openCheckoutReviews(f.dependencies,f.file),other=openCheckoutReviews(f.dependencies,f.file),request=input();try{
  const pending=s.prepare(request);await assert.rejects(other.prepare(request),(error:unknown)=>error instanceof ApiError&&error.code==="review_in_progress");await assert.rejects(other.prepare(input()),(error:unknown)=>error instanceof ApiError&&error.status===429);release();await pending;assert.equal(s.list().length,1);assert.equal(f.calls,1);
 }finally{release();s.close();other.close();f.dispose();}
});
test("unknown imported products, expired FX and price overflow never produce payable reviews",async()=>{
 for(const kind of ["missing","fx","overflow"]){const f=fixture();if(kind==="missing")f.dependencies.imported=()=>false;if(kind==="fx")f.dependencies.fx=async()=>({rateMicros:1,asOf:new Date(epoch-1000).toISOString(),validUntil:new Date(epoch-1).toISOString()});if(kind==="overflow"){const base=f.dependencies.check;f.dependencies.check=async line=>({...await base(line),costUsdMinor:Number.MAX_SAFE_INTEGER});}const s=openCheckoutReviews(f.dependencies,f.file);try{await assert.rejects(s.prepare(input()));assert.equal(s.list()[0].status,"failed");assert.equal(s.list()[0].review,null);}finally{s.close();f.dispose();}}
});
